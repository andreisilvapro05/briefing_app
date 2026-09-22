import { createSupabaseServiceRoleClient } from "./supabase/server";
import { logServerError } from "./api-helpers";
import {
  normalizarAcessos,
  normalizarBotoes,
  normalizarPixels,
  type BotaoPagina,
  type FichaImplementacao,
  type PixelPagina,
} from "./ficha-implementacao";
import type { CredencialItem } from "./briefing-credenciais";
import type { ProjectTask, TaskStatus } from "./project-tasks";

/**
 * Leitura e escrita da ficha de implementação (server-only, service-role —
 * `ei_documents` tem RLS ligado e nenhuma policy, como o resto do app).
 *
 * Separado de `ei-documents-server.ts` de propósito: aquele arquivo carrega
 * o CORPO do documento (`ei_data.blocks`, que é o BlockNote inteiro). Quem
 * só implementa não deve receber o corpo, e a melhor garantia de não vazar
 * é a consulta nunca pedir a coluna.
 */

const COLS_FICHA =
  "id, client_id, nome, figma_url, botoes, pixels, credenciais, updated_at, referencia_em, arquivado, clients(id, nome, empresa)";

interface RawFicha {
  id: string;
  client_id: string | null;
  nome: string | null;
  figma_url: string | null;
  botoes: unknown;
  pixels: unknown;
  credenciais: unknown;
  updated_at: string;
  referencia_em: string | null;
  arquivado: boolean;
  clients: { id: string; nome: string | null; empresa: string | null } | null;
}

function normalizar(row: RawFicha): FichaImplementacao {
  return {
    docId: row.id,
    clientId: String(row.client_id),
    titulo:
      row.clients?.empresa ||
      row.clients?.nome ||
      row.nome ||
      "Estrutura Inicial",
    figmaUrl: row.figma_url?.trim() || null,
    botoes: normalizarBotoes(row.botoes),
    pixels: normalizarPixels(row.pixels),
    acessos: normalizarAcessos(row.credenciais),
    atualizadoEm: row.updated_at,
  };
}

/**
 * A ficha de um cliente = a Estrutura Inicial ATIVA mais recente dele.
 *
 * Um cliente pode ter várias EIs desde a migration 20260922120000 (uma por
 * projeto, mais o arquivo histórico importado do ClickUp). A que vale pra
 * quem está implementando agora é a mais nova que não foi arquivada;
 * `referencia_em` (a data que a página tem no ClickUp) vem antes de
 * `created_at` porque, numa importação em lote, `created_at` é igual pra
 * todas e não diz nada.
 */
export async function getFichaDoCliente(
  clientId: string
): Promise<FichaImplementacao | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(COLS_FICHA)
    .eq("client_id", clientId)
    .eq("kind", "ei")
    .eq("arquivado", false)
    .order("referencia_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return normalizar(data as unknown as RawFicha);
}

/** A ficha de um documento específico — usada pelo painel na tela da EI. */
export async function getFichaDoDocumento(
  docId: string
): Promise<FichaImplementacao | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(COLS_FICHA)
    .eq("id", docId)
    .maybeSingle();
  const row = data as unknown as RawFicha | null;
  // Documento sem cliente (o Modelo) não tem ficha: não há página pra
  // implementar nem acesso de ninguém pra guardar.
  if (!row?.client_id) return null;
  return normalizar(row);
}

export interface PatchFicha {
  figmaUrl?: string | null;
  botoes?: BotaoPagina[];
  pixels?: PixelPagina[];
  acessos?: CredencialItem[];
}

/** Grava só o que veio no patch — cada bloco da ficha salva sozinho. */
export async function salvarFicha(
  docId: string,
  patch: PatchFicha
): Promise<boolean> {
  const update: Record<string, unknown> = {};
  if ("figmaUrl" in patch) update.figma_url = patch.figmaUrl || null;
  if (patch.botoes) update.botoes = patch.botoes;
  if (patch.pixels) update.pixels = patch.pixels;
  if (patch.acessos) update.credenciais = patch.acessos;
  if (Object.keys(update).length === 0) return true;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update(update)
    .eq("id", docId);
  if (error) logServerError("ficha-implementacao.salvar", error);
  return !error;
}

export interface TarefaDeImplementacao extends ProjectTask {
  clienteNome: string;
  /** null = o cliente ainda não tem Estrutura Inicial ativa. */
  docId: string | null;
}

/**
 * As tarefas de uma pessoa, com o nome do cliente e o documento da ficha
 * junto. `visibleIds` aplica o escopo do papel (getVisibleClientIds); null
 * = sem filtro.
 *
 * Só tarefa COM cliente: a ficha de implementação é de uma página de
 * projeto, e demanda interna da agência ("revisar contrato padrão") não tem
 * página nenhuma pra montar.
 */
export async function listarTarefasDe(
  responsavel: string,
  visibleIds: Set<string> | null
): Promise<TarefaDeImplementacao[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("*, clients(id, nome, empresa)")
    .eq("responsavel", responsavel)
    .not("client_id", "is", null)
    .order("data_vencimento", { ascending: true, nullsFirst: false });

  const rows = (data as Record<string, unknown>[] | null) ?? [];
  const noEscopo = rows.filter(
    (r) => !visibleIds || visibleIds.has(String(r.client_id))
  );
  if (noEscopo.length === 0) return [];

  // Um SELECT só pros documentos de todos os clientes da lista — o laço
  // ingênuo faria uma consulta por tarefa.
  const clientIds = [...new Set(noEscopo.map((r) => String(r.client_id)))];
  const { data: docs } = await service
    .from("ei_documents")
    .select("id, client_id, referencia_em, created_at")
    .eq("kind", "ei")
    .eq("arquivado", false)
    .in("client_id", clientIds)
    .order("referencia_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const docPorCliente = new Map<string, string>();
  for (const d of (docs as { id: string; client_id: string }[] | null) ?? []) {
    // A consulta já vem ordenada: o primeiro de cada cliente é o mais recente.
    if (!docPorCliente.has(d.client_id)) docPorCliente.set(d.client_id, d.id);
  }

  return noEscopo.map((row) => {
    const cliente = row.clients as {
      nome: string | null;
      empresa: string | null;
    } | null;
    const clientId = String(row.client_id);
    return {
      id: String(row.id),
      client_id: clientId,
      area: (row.area as string | null) ?? null,
      titulo: String(row.titulo ?? ""),
      ordem: Number(row.ordem ?? 0),
      status: (row.status as TaskStatus) ?? "a-iniciar",
      prioridade: (row.prioridade as string | null) ?? null,
      eisenhower: (row.eisenhower as string | null) ?? null,
      esforco: (row.esforco as string | null) ?? null,
      responsavel: (row.responsavel as string | null) ?? null,
      data_inicial: (row.data_inicial as string | null) ?? null,
      data_vencimento: (row.data_vencimento as string | null) ?? null,
      concluida_em: (row.concluida_em as string | null) ?? null,
      observacoes: (row.observacoes as string | null) ?? null,
      origem:
        row.origem === "manual" || row.origem === "clickup"
          ? (row.origem as "manual" | "clickup")
          : "template",
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
      clienteNome: cliente?.empresa || cliente?.nome || "Sem nome",
      docId: docPorCliente.get(clientId) ?? null,
    };
  });
}

/** Uma tarefa pelo id, com o cliente — a ficha de trabalho carrega por aqui. */
export async function getTarefaComCliente(
  taskId: string
): Promise<TarefaDeImplementacao | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("*, clients(id, nome, empresa)")
    .eq("id", taskId)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  if (!row) return null;
  const cliente = row.clients as {
    nome: string | null;
    empresa: string | null;
  } | null;
  return {
    id: String(row.id),
    client_id: row.client_id ? String(row.client_id) : null,
    area: (row.area as string | null) ?? null,
    titulo: String(row.titulo ?? ""),
    ordem: Number(row.ordem ?? 0),
    status: (row.status as TaskStatus) ?? "a-iniciar",
    prioridade: (row.prioridade as string | null) ?? null,
      eisenhower: (row.eisenhower as string | null) ?? null,
      esforco: (row.esforco as string | null) ?? null,
    responsavel: (row.responsavel as string | null) ?? null,
    data_inicial: (row.data_inicial as string | null) ?? null,
    data_vencimento: (row.data_vencimento as string | null) ?? null,
    concluida_em: (row.concluida_em as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    origem:
      row.origem === "manual" || row.origem === "clickup"
        ? (row.origem as "manual" | "clickup")
        : "template",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    clienteNome: cliente?.empresa || cliente?.nome || "Sem nome",
    docId: null,
  };
}
