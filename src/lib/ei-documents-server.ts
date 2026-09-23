import type { PartialBlock } from "@blocknote/core";
import { createSupabaseServiceRoleClient } from "./supabase/server";
import { logServerError } from "./api-helpers";
import {
  eiDocumentTitle,
  type EIDocument,
  type EIDocumentClientInfo,
  type EIDocumentKind,
  type EIDocumentSummary,
} from "./ei-documents";

interface RawRow {
  id: string;
  client_id: string | null;
  nome: string | null;
  is_template: boolean;
  kind: EIDocumentKind;
  ei_data: { blocks?: unknown[] } | null;
  created_at: string;
  updated_at: string;
  clients: {
    id: string;
    nome: string | null;
    empresa: string | null;
    fysi_drive_link: string | null;
    cliente_drive_link: string | null;
  } | null;
}

function clientInfo(row: RawRow): EIDocumentClientInfo | null {
  if (!row.clients) return null;
  return {
    id: row.clients.id,
    nome: row.clients.nome,
    empresa: row.clients.empresa,
    fysiDriveLink: row.clients.fysi_drive_link,
    clienteDriveLink: row.clients.cliente_drive_link,
  };
}

function normalize(row: RawRow): EIDocument {
  return {
    id: row.id,
    clientId: row.client_id,
    isTemplate: row.is_template,
    kind: row.kind,
    nome: row.nome,
    blocks: Array.isArray(row.ei_data?.blocks)
      ? (row.ei_data.blocks as PartialBlock[])
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client: clientInfo(row),
  };
}

const CLIENT_COLS = "id, nome, empresa, fysi_drive_link, cliente_drive_link";
const SELECT_FULL = `id, client_id, nome, is_template, kind, ei_data, created_at, updated_at, clients(${CLIENT_COLS})`;

/** Lista todos os documentos de um kind pra sidebar do hub — Modelo primeiro, depois alfabético. */
export async function listEIDocuments(
  kind: EIDocumentKind
): Promise<EIDocumentSummary[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(
      `id, client_id, nome, is_template, kind, updated_at, arquivado, referencia_em, clients(${CLIENT_COLS})`
    )
    .eq("kind", kind);

  type Linha = RawRow & { arquivado: boolean | null; referencia_em: string | null };
  const rows = ((data as unknown as Linha[]) ?? []).map((r) => ({
    id: r.id,
    title: eiDocumentTitle({ isTemplate: r.is_template, nome: r.nome, client: clientInfo(r) }),
    isTemplate: r.is_template,
    clientId: r.client_id,
    kind: r.kind,
    updatedAt: r.updated_at,
    arquivado: Boolean(r.arquivado),
    referenciaEm: r.referencia_em,
  }));

  // Modelo primeiro, depois os ativos, depois o arquivo — cada bloco em
  // ordem alfabética, que é como se procura um nome. Dentro do mesmo título
  // (cliente com várias EIs), a mais recente vem antes.
  rows.sort((a, b) => {
    if (a.isTemplate !== b.isTemplate) return a.isTemplate ? -1 : 1;
    if (a.arquivado !== b.arquivado) return a.arquivado ? 1 : -1;
    const porTitulo = a.title.localeCompare(b.title, "pt-BR");
    if (porTitulo !== 0) return porTitulo;
    return (b.referenciaEm ?? b.updatedAt).localeCompare(
      a.referenciaEm ?? a.updatedAt
    );
  });

  return rows;
}

export async function getEIDocument(docId: string): Promise<EIDocument | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(SELECT_FULL)
    .eq("id", docId)
    .maybeSingle();
  if (!data) return null;
  return normalize(data as unknown as RawRow);
}

/**
 * Só o id do documento Modelo. As telas de índice (que apenas redirecionam
 * pro Modelo) usavam getTemplateDocument, que traz o JSON `ei_data` inteiro
 * e faz join com clients — payload grande pra ler um id.
 */
export async function getTemplateDocumentId(
  kind: EIDocumentKind
): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id")
    .eq("is_template", true)
    .eq("kind", kind)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function getTemplateDocument(
  kind: EIDocumentKind
): Promise<EIDocument | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(SELECT_FULL)
    .eq("is_template", true)
    .eq("kind", kind)
    .maybeSingle();
  if (!data) return null;
  return normalize(data as unknown as RawRow);
}

export async function getClientEIDocumentId(
  clientId: string,
  kind: EIDocumentKind = "ei"
): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Versão em lote de getClientEIDocumentId — evita N queries em telas com vários clientes (pizza, tarefas). */
export async function getEIDocumentIdsForClients(
  clientIds: string[],
  kind: EIDocumentKind = "ei"
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (clientIds.length === 0) return map;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id, client_id")
    .eq("kind", kind)
    .in("client_id", clientIds);
  for (const row of (data as { id: string; client_id: string | null }[] | null) ?? []) {
    if (row.client_id) map.set(row.client_id, row.id);
  }
  return map;
}

/**
 * Mapa client_id → doc_id de TODOS os documentos do kind, sem precisar da
 * lista de clientes antes. Existe pra que quem já vai buscar clientes possa
 * disparar esta consulta em PARALELO, em vez de esperar os clientes só pra
 * montar o filtro `.in()`. A tabela é pequena (≤ 1 doc por cliente/kind).
 */
export async function getAllEIDocumentIdsByClient(
  kind: EIDocumentKind = "ei"
): Promise<Map<string, string>> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id, client_id")
    .eq("kind", kind)
    .not("client_id", "is", null);
  const map = new Map<string, string>();
  for (const row of (data as { id: string; client_id: string | null }[] | null) ?? []) {
    if (row.client_id) map.set(row.client_id, row.id);
  }
  return map;
}

/** Clientes que ainda não têm documento desse kind — pra popular o seletor de criação. */
export async function listClientsWithoutEIDocument(
  kind: EIDocumentKind
): Promise<{ id: string; nome: string | null; empresa: string | null }[]> {
  const service = createSupabaseServiceRoleClient();
  const { data: docs } = await service
    .from("ei_documents")
    .select("client_id")
    .eq("kind", kind)
    // Só o que está ATIVO conta como "já tem": cliente que voltou e só tem a
    // Estrutura Inicial antiga no arquivo precisa poder abrir uma nova.
    .eq("arquivado", false)
    .not("client_id", "is", null);
  const usedIds = new Set(
    ((docs as { client_id: string }[]) ?? []).map((d) => d.client_id)
  );

  const { data: clients } = await service
    .from("clients")
    .select("id, nome, empresa")
    .order("empresa", { ascending: true });

  return (
    (clients as { id: string; nome: string | null; empresa: string | null }[]) ?? []
  ).filter((c) => !usedIds.has(c.id));
}

/**
 * Busca o documento de um cliente pra esse kind — cria na hora (clonando os
 * blocks do Modelo) se ainda não existir. Usado pela aba Briefing do cliente,
 * que precisa do documento pronto pra editar assim que a tela abre, sem
 * passo extra de "criar" (diferente do hub de EI, que tem botão explícito).
 */
/**
 * Busca o documento do cliente SEM criar.
 *
 * Existe porque `getOrCreateClientDocument` era chamado no carregamento da
 * ficha: só ABRIR a ficha de um cliente já criava um briefing clonado do
 * modelo. Em 2026-09-21 havia 23 briefings no banco, todos byte a byte
 * idênticos, enchendo o hub de Briefings de documentos em branco que
 * pareciam reais. Criar agora é um gesto explícito de quem vai preencher.
 */
export async function getClientDocument(
  clientId: string,
  kind: EIDocumentKind
): Promise<EIDocument | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(SELECT_FULL)
    .eq("client_id", clientId)
    .eq("kind", kind)
    // Desde 22/09 um cliente pode ter VÁRIAS EIs (as importadas do ClickUp,
    // versões antigas no arquivo). A ficha abre a que está em uso: ativa
    // antes de arquivada, e a mais recente entre as ativas. Antes era
    // `created_at asc` — abria e EDITAVA a mais antiga, inclusive arquivada.
    .order("arquivado", { ascending: true })
    .order("referencia_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? normalize(data as unknown as RawRow) : null;
}

export async function getOrCreateClientDocument(
  clientId: string,
  kind: EIDocumentKind
): Promise<EIDocument | null> {
  // Reusa a mesma escolha de getClientDocument. O `.maybeSingle()` sem
  // `limit` que havia aqui era uma armadilha: com mais de uma linha o
  // PostgREST devolve erro, `existing` vinha nulo e a função CRIAVA um
  // documento novo a cada abertura da ficha — exatamente o vazamento de
  // clones que o comentário acima conta ter sido caçado em 21/09.
  const existing = await getClientDocument(clientId, kind);
  if (existing) return existing;

  const service = createSupabaseServiceRoleClient();

  const template = await getTemplateDocument(kind);
  const { data: created, error } = await service
    .from("ei_documents")
    .insert({
      client_id: clientId,
      kind,
      ei_data: { blocks: template?.blocks ?? [] },
    })
    .select(SELECT_FULL)
    .maybeSingle();
  // Sem o log, um insert barrado virava `null` — indistinguível de
  // "o cliente ainda não tem documento", e a tela mostrava o estado vazio.
  if (error) logServerError("documento.criar", error);
  if (!created) return null;
  return normalize(created as unknown as RawRow);
}
