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
import { ataExiste, clienteDaLinha, clientesDaAta } from "@/lib/atas-server";

/**
 * Escritas da ata de acompanhamento.
 *
 * UMA ATA = UMA REUNIÃO, com vários clientes dentro (Karine, 05/10: "não é
 * pra ser individual de cada cliente, e sim tudo num documento só, poder
 * puxar todos os clientes dentro de um mesmo documento").
 *
 * O texto longo da ata NÃO tem action aqui: o documento de blocos é o
 * mesmo `ei_documents.ei_data` dos outros hubs, salvo pelo
 * `updateEIDocumentAction` que o editor já chama (autosave debounced). O
 * status do projeto também não: quem escreve é o `setClientStatusAction`,
 * que a tela usa pelo `StatusChanger`. Reusar os dois significa uma
 * superfície de autorização a menos pra errar.
 */

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Quem pode mexer em ata.
 *
 * Lembrete do projeto: `getCurrentMember` é AUTENTICAÇÃO. A autorização é
 * o que vem depois — o desenvolvedor tem tarefa em clientes e passaria num
 * escopo por cliente, mas a ata é o registro de gestão da agência e a tela
 * ele nem vê; Server Action, porém, é um POST próprio que não passa pelo
 * AdminShell.
 *
 * A ATA EM SI (criar, renomear, mudar a data, arquivar, apagar) é da
 * reunião inteira, não de um cliente: exige acesso completo. Só as LINHAS
 * aceitam o recorte por cliente, logo abaixo.
 */
async function exigirAcessoDeGestao(urlKey: string | null): Promise<Member> {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (isDeveloper(member) || !hasFullAccess(member)) {
    redirect(`${telaInicialDe(member)}${keyParam(urlKey)}`);
  }
  return member;
}

/** Mexer na LINHA de um cliente: basta ver aquele cliente. */
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

/** As telas que mudam quando uma ata nasce, muda ou ganha cliente. */
function revalidarAtas(ataId: string | null) {
  revalidatePath("/admin/ata");
  if (ataId) revalidatePath(`/admin/ata/${ataId}`);
  revalidatePath("/admin/meu-trabalho");
}

/**
 * Abre uma ata nova — uma reunião, numa data, ainda sem cliente nenhum.
 *
 * Os clientes entram depois, pelo "+ Puxar cliente" de dentro da ata. É o
 * gesto real: abre-se a ata da segunda e vai-se passando pelos projetos.
 */
export async function criarAtaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcessoDeGestao(urlKey);

  const diaCru = String(formData.get("dia") ?? "").trim();
  const dia = diaValido(diaCru) ? diaCru : hojeEmBrasilia();
  const titulo = String(formData.get("titulo") ?? "").trim().slice(0, 160);

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("ei_documents")
    .insert({
      // `client_id` NULO: a ata é da agência, não de um cliente. Ver a
      // migration 20261005120000.
      client_id: null,
      kind: "ata",
      nome: titulo || `Ata de ${dia.split("-").reverse().join("/")}`,
      referencia_em: diaParaReferencia(dia),
      // Um parágrafo vazio: o editor de blocos não abre num documento sem
      // bloco nenhum — fica um retângulo morto que não aceita clique.
      ei_data: { blocks: [{ type: "paragraph", content: [] }] },
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("ata.criar", error);
    redirect(`/admin/ata${keyParam(urlKey)}`);
  }

  const ataId = (data as { id: string }).id;
  revalidarAtas(ataId);
  redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
}

/** Título e data da reunião. */
export async function salvarCabecalhoDaAtaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  await exigirAcessoDeGestao(urlKey);
  if (!ataId || !(await ataExiste(ataId))) {
    redirect(`/admin/ata${keyParam(urlKey)}`);
  }

  const titulo = String(formData.get("titulo") ?? "").trim().slice(0, 160);
  const diaCru = String(formData.get("dia") ?? "").trim();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (formData.has("titulo")) patch.nome = titulo || null;
  // Dia torto não apaga a data que estava lá — ver `diaValido`, que recusa
  // tanto formato errado quanto dia que não existe (31 de fevereiro).
  if (diaValido(diaCru)) patch.referencia_em = diaParaReferencia(diaCru);

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update(patch)
    .eq("id", ataId)
    .eq("kind", "ata");
  if (error) logServerError("ata.cabecalho", error);

  revalidarAtas(ataId);
  redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
}

/**
 * Puxa um cliente pra dentro da ata.
 *
 * Idempotente pelo índice único `(ata_id, client_id)`: puxar duas vezes
 * não cria duas linhas. É o oposto da ata em si, que pode se repetir por
 * data — aqui repetir é sempre engano.
 */
export async function puxarClienteAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!ataId || !clientId) redirect(`/admin/ata${keyParam(urlKey)}`);
  await exigirAcessoAoCliente(clientId, urlKey);
  if (!(await ataExiste(ataId))) redirect(`/admin/ata${keyParam(urlKey)}`);

  const jaTem = await clientesDaAta(ataId);
  if (jaTem.has(clientId)) {
    redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("ata_linhas").insert({
    ata_id: ataId,
    client_id: clientId,
    // No fim da lista: a ordem em que o Andrei puxa é a ordem em que ele
    // quer passar pelos projetos na reunião.
    ordem: jaTem.size,
  });
  if (error) logServerError("ata.puxar-cliente", error);

  revalidarAtas(ataId);
  redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
}

/** A observação daquele cliente nesta reunião. */
export async function salvarObservacaoAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  const linhaId = String(formData.get("linhaId") ?? "").trim();
  if (!linhaId) redirect(`/admin/ata${keyParam(urlKey)}`);

  // O cliente sai do BANCO, pelo id da linha — nunca do formulário.
  const clientId = await clienteDaLinha(linhaId);
  if (!clientId) redirect(`/admin/ata${keyParam(urlKey)}`);
  await exigirAcessoAoCliente(clientId, urlKey);

  const observacao = String(formData.get("observacao") ?? "").trim().slice(0, 4000);

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ata_linhas")
    .update({ observacao: observacao || null, updated_at: new Date().toISOString() })
    .eq("id", linhaId);
  if (error) logServerError("ata.observacao", error);

  revalidarAtas(ataId || null);
  redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
}

/**
 * Tira um cliente da ata.
 *
 * Isto é "puxei por engano", não "o projeto acabou" — projeto finalizado
 * sai sozinho da visão principal, pelo status, e a linha dele FICA (a ata
 * é registro do que foi dito naquela reunião).
 */
export async function removerClienteDaAtaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  const linhaId = String(formData.get("linhaId") ?? "").trim();
  if (!linhaId) redirect(`/admin/ata${keyParam(urlKey)}`);

  const clientId = await clienteDaLinha(linhaId);
  if (!clientId) redirect(`/admin/ata${keyParam(urlKey)}`);
  await exigirAcessoAoCliente(clientId, urlKey);

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("ata_linhas").delete().eq("id", linhaId);
  if (error) logServerError("ata.remover-cliente", error);

  revalidarAtas(ataId || null);
  redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
}

/** Tira a ata da visão principal, sem apagar. */
export async function arquivarAtaAction(formData: FormData): Promise<void> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  const arquivar = String(formData.get("arquivar") ?? "1") === "1";
  await exigirAcessoDeGestao(urlKey);
  if (!ataId || !(await ataExiste(ataId))) {
    redirect(`/admin/ata${keyParam(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({ arquivado: arquivar, updated_at: new Date().toISOString() })
    .eq("id", ataId)
    .eq("kind", "ata");
  if (error) logServerError("ata.arquivar", error);

  revalidarAtas(ataId);
  redirect(`/admin/ata${keyParam(urlKey)}`);
}

/**
 * Apaga a ata de vez — com as linhas junto (cascade no FK).
 *
 * Existe pro caso de ata criada por engano. O caminho normal é arquivar:
 * ata é histórico de reunião, e apagar histórico não se desfaz.
 */
export async function apagarAtaAction(formData: FormData): Promise<void> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  await exigirAcessoDeGestao(urlKey);
  if (!ataId || !(await ataExiste(ataId))) {
    redirect(`/admin/ata${keyParam(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .delete()
    .eq("id", ataId)
    .eq("kind", "ata");
  if (error) {
    logServerError("ata.apagar", error);
    redirect(`/admin/ata/${ataId}${keyParam(urlKey)}`);
  }

  revalidarAtas(null);
  redirect(`/admin/ata${keyParam(urlKey)}`);
}
