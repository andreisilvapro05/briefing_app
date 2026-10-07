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
import {
  ataExiste,
  clienteDaLinha,
  clientesDaAta,
  clientesParaAta,
} from "@/lib/atas-server";

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
 * Abre uma ata nova JÁ COM OS PROJETOS ATIVOS dentro.
 *
 * Karine (07/10): "deve ficar mais simples... já pré-listar aqui os
 * clientes principais". A primeira versão nascia vazia e exigia puxar
 * cliente por cliente num seletor — com 25 projetos ativos, isso é 25
 * idas ao menu antes de escrever a primeira linha.
 *
 * A reunião de acompanhamento passa pelos projetos que estão ANDANDO, e o
 * app já sabe quais são. Quem não entrou na conversa sai pelo "✕" da
 * linha; quem faltou entra pelo seletor, que continua existindo.
 */
export async function criarAtaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await exigirAcessoDeGestao(urlKey);

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

  /**
   * Pré-lista os projetos ATIVOS, na ordem em que a Lista os mostra.
   *
   * `clientesParaAta` já exclui arquivado (desistência). Projeto finalizado
   * entra, mas cai direto no bloco das encerradas pela regra do status —
   * então a lista que aparece é só o que está em andamento.
   */
  const ativos = await clientesParaAta(await getVisibleClientIds(member));
  if (ativos.length > 0) {
    const { error: erroLinhas } = await service.from("ata_linhas").insert(
      ativos.map((c, i) => ({ ata_id: ataId, client_id: c.id, ordem: i }))
    );
    // Falhar aqui não pode impedir a ata de existir: ela abre vazia e os
    // clientes entram pelo seletor, que continua lá.
    if (erroLinhas) logServerError("ata.pre-listar", erroLinhas);
  }

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

/**
 * Salva TODAS as observações da ata de uma vez.
 *
 * Karine (07/10): "deve ficar mais simples". Antes havia um formulário e
 * um botão "Salvar" por linha — numa ata de 25 projetos, 25 botões e 25
 * recarregamentos de página pra escrever uma ata. A reunião é um gesto só:
 * passa-se pelos projetos anotando, e salva-se no fim.
 *
 * O campo de cada linha é `obs:<linhaId>`. O id vem do formulário, mas o
 * CLIENTE de cada linha é lido do banco antes de escrever — e linha que
 * não é desta ata é descartada.
 */
export async function salvarObservacoesAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const ataId = String(formData.get("ataId") ?? "").trim();
  if (!ataId || !(await ataExiste(ataId))) {
    redirect(`/admin/ata${keyParam(urlKey)}`);
  }
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (isDeveloper(member)) {
    redirect(`${telaInicialDe(member)}${keyParam(urlKey)}`);
  }
  const visiveis = hasFullAccess(member) ? null : await getVisibleClientIds(member);

  const service = createSupabaseServiceRoleClient();
  // As linhas REAIS desta ata, do banco — é o que impede um formulário
  // adulterado de escrever na linha de outra reunião.
  const { data: linhasRows } = await service
    .from("ata_linhas")
    .select("id, client_id")
    .eq("ata_id", ataId);
  const linhas = (linhasRows as { id: string; client_id: string }[] | null) ?? [];

  const agora = new Date().toISOString();
  await Promise.all(
    linhas.map(async (l) => {
      if (visiveis && !visiveis.has(l.client_id)) return;
      const campo = formData.get(`obs:${l.id}`);
      // Campo ausente = a linha não estava na tela (ex.: recolhida). Não
      // mexe — ausente não é o mesmo que apagado.
      if (campo === null) return;
      const observacao = String(campo).trim().slice(0, 4000);
      const { error } = await service
        .from("ata_linhas")
        .update({ observacao: observacao || null, updated_at: agora })
        .eq("id", l.id);
      if (error) logServerError("ata.observacoes", error);
    })
  );

  revalidarAtas(ataId);
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
