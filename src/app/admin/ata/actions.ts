"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
  isDeveloper,
  telaInicialDe,
  type Member,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
import { hojeEmBrasilia } from "@/lib/datas";
import { diaParaReferencia, diaValido } from "@/lib/atas";
import { clienteDaAta } from "@/lib/atas-server";

/**
 * Escritas da ata de acompanhamento.
 *
 * O texto longo da ata NÃO tem action aqui: o documento de blocos é o
 * mesmo `ei_documents.ei_data` dos outros hubs, salvo pelo
 * `updateEIDocumentAction` que o editor já chama (autosave debounced). O
 * status do projeto também não: quem escreve é o `setClientStatusAction`,
 * que a tela usa pelo `StatusChanger`. Reusar os dois significa uma
 * superfície de autorização a menos pra errar.
 *
 * Sobra pra cá o que é só da ata: criar, o cabeçalho (data + observação),
 * arquivar e apagar.
 */

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Autenticação + escopo por cliente, no mesmo corte do
 * `requireClientAccess` da ficha do cliente.
 *
 * Lembrete do projeto: `getCurrentMember` é AUTENTICAÇÃO. A autorização é
 * o que vem depois — o desenvolvedor tem tarefa no cliente e passaria no
 * escopo, mas a ata é o registro de gestão do projeto e a tela ele nem vê;
 * Server Action, porém, é um POST próprio que não passa pelo AdminShell.
 */
async function exigirAcessoAoCliente(
  clientId: string,
  urlKey: string | null
): Promise<Member> {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (isDeveloper(member)) {
    redirect(`${telaInicialDe(member)}${keyParam(urlKey)}`);
  }
  if (!hasFullAccess(member)) {
    const visiveis = await getVisibleClientIds(member);
    if (visiveis && !visiveis.has(clientId)) {
      redirect(`/admin/ata${keyParam(urlKey)}`);
    }
  }
  return member;
}

/** O mesmo, partindo da ata: o cliente é lido do banco, não do formulário. */
async function exigirAcessoAAta(
  ataId: string,
  urlKey: string | null
): Promise<{ member: Member; clientId: string }> {
  const clientId = await clienteDaAta(ataId);
  if (!clientId) redirect(`/admin/ata${keyParam(urlKey)}`);
  const member = await exigirAcessoAoCliente(clientId, urlKey);
  return { member, clientId };
}

/** As telas que mudam quando uma ata nasce, muda de data ou é arquivada. */
function revalidarAtas(ataId: string | null, clientId: string) {
  revalidatePath("/admin/ata");
  if (ataId) revalidatePath(`/admin/ata/${ataId}`);
  revalidatePath("/admin/meu-trabalho");
  revalidatePath(`/admin/${clientId}`);
}

/**
 * Abre uma ata nova pra um cliente numa data.
 *
 * Não é idempotente de propósito, ao contrário do `createEIDocumentAction`:
 * ter VÁRIAS atas do mesmo cliente é o pedido ("precisa ter os documentos
 * por datas"), então clicar duas vezes cria duas. O `SubmitButton` do
 * formulário desabilita durante o envio, que é o que evita o clique duplo
 * sem transformar "quero outra ata de hoje" em erro.
 */
export async function criarAtaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!clientId) redirect(`/admin/ata${keyParam(urlKey)}`);
  await exigirAcessoAoCliente(clientId, urlKey);

  // Sem data escolhida, é hoje em Brasília — o servidor roda em UTC na
  // Vercel, e `toISOString()` daria amanhã depois das 21h.
  const diaBruto = String(formData.get("data") ?? "").trim();
  const dia = diaValido(diaBruto) ? diaBruto : hojeEmBrasilia();
  const observacao =
    String(formData.get("observacao") ?? "").trim().slice(0, 2000) || null;

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("ei_documents")
    .insert({
      client_id: clientId,
      kind: "ata",
      is_template: false,
      referencia_em: diaParaReferencia(dia),
      observacao,
      // Nasce vazia: ata não tem Modelo. O documento é o espaço livre pra
      // escrever o que a reunião rendeu.
      ei_data: { blocks: [] },
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("ata.criar", error);
    // Monta a query com URLSearchParams: concatenar "&erro=..." na mão
    // produz `/admin/ata&erro=criar` quando não há `?key=` — uma URL que
    // não existe, e o erro viraria um 404 em vez de um aviso na tela.
    const sp = new URLSearchParams();
    if (urlKey) sp.set("key", urlKey);
    sp.set("erro", "criar");
    redirect(`/admin/ata?${sp.toString()}`);
  }

  const ataId = (data as { id: string }).id;
  revalidarAtas(ataId, clientId);
  redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
}

/**
 * Cabeçalho da ata: a data e a observação curta, num formulário só.
 *
 * Juntas porque são o cabeçalho do mesmo registro — dois botões "Salvar"
 * em campos vizinhos fazem a pessoa salvar um e esquecer o outro.
 */
export async function salvarCabecalhoDaAtaAction(
  formData: FormData
): Promise<void> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  if (!ataId) return;
  const { clientId } = await exigirAcessoAAta(ataId, urlKey);

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Observação vazia volta a ser null, não string vazia: a lista testa
  // "tem observação?" e `""` responderia que sim.
  update.observacao =
    String(formData.get("observacao") ?? "").trim().slice(0, 2000) || null;

  const dia = String(formData.get("data") ?? "").trim();
  // Data inválida não zera a que está gravada — a ata ficaria sem o eixo
  // pelo qual ela é organizada. Salva o resto e deixa a data como estava.
  if (diaValido(dia)) update.referencia_em = diaParaReferencia(dia);

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update(update)
    .eq("id", ataId)
    .eq("kind", "ata");
  if (error) logServerError("ata.cabecalho", error);

  revalidarAtas(ataId, clientId);
}

/**
 * Arquiva (ou desarquiva) uma ata à mão.
 *
 * Diferente do "some dali" automático, que é derivado do status do
 * cliente e não escreve nada: este é o gesto de quem quer tirar da frente
 * uma ata específica de um projeto que segue em andamento.
 */
export async function arquivarAtaAction(formData: FormData): Promise<void> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  if (!ataId) return;
  const { clientId } = await exigirAcessoAAta(ataId, urlKey);

  const arquivar = String(formData.get("arquivar") ?? "") === "1";

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({ arquivado: arquivar, updated_at: new Date().toISOString() })
    .eq("id", ataId)
    .eq("kind", "ata");
  if (error) logServerError("ata.arquivar", error);

  revalidarAtas(ataId, clientId);
}

/**
 * Apaga uma ata de vez.
 *
 * Existe pra ata criada no cliente errado, não pra "limpar" o histórico:
 * o fim normal de uma ata é o arquivo, que é o que o pedido pede ("some
 * dali", não "apaga"). O botão pede confirmação na tela.
 */
export async function apagarAtaAction(formData: FormData): Promise<void> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  if (!ataId) return;
  const { member, clientId } = await exigirAcessoAAta(ataId, urlKey);
  // Apagar é irreversível: fica com quem tem acesso completo. Quem só
  // alcança o próprio projeto arquiva.
  if (!hasFullAccess(member)) {
    redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();
  // O `kind` no delete não é decoração: os cinco tipos de documento
  // dividem a tabela, e um id de briefing chegando aqui não pode virar
  // exclusão de briefing.
  const { error } = await service
    .from("ei_documents")
    .delete()
    .eq("id", ataId)
    .eq("kind", "ata");
  if (error) logServerError("ata.apagar", error);

  revalidarAtas(null, clientId);
  redirect(`/admin/ata${keyParam(urlKey)}`);
}
