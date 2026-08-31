import type { PartialBlock } from "@blocknote/core";
import { createSupabaseServiceRoleClient } from "./supabase/server";
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
    .select(`id, client_id, nome, is_template, kind, updated_at, clients(${CLIENT_COLS})`)
    .eq("kind", kind);

  const rows = ((data as unknown as RawRow[]) ?? []).map((r) => ({
    id: r.id,
    title: eiDocumentTitle({ isTemplate: r.is_template, nome: r.nome, client: clientInfo(r) }),
    isTemplate: r.is_template,
    clientId: r.client_id,
    kind: r.kind,
    updatedAt: r.updated_at,
  }));

  rows.sort((a, b) => {
    if (a.isTemplate !== b.isTemplate) return a.isTemplate ? -1 : 1;
    return a.title.localeCompare(b.title, "pt-BR");
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

/** Clientes que ainda não têm documento desse kind — pra popular o seletor de criação. */
export async function listClientsWithoutEIDocument(
  kind: EIDocumentKind
): Promise<{ id: string; nome: string | null; empresa: string | null }[]> {
  const service = createSupabaseServiceRoleClient();
  const { data: docs } = await service
    .from("ei_documents")
    .select("client_id")
    .eq("kind", kind)
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
export async function getOrCreateClientDocument(
  clientId: string,
  kind: EIDocumentKind
): Promise<EIDocument | null> {
  const service = createSupabaseServiceRoleClient();
  const { data: existing } = await service
    .from("ei_documents")
    .select(SELECT_FULL)
    .eq("client_id", clientId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing) return normalize(existing as unknown as RawRow);

  const template = await getTemplateDocument(kind);
  const { data: created } = await service
    .from("ei_documents")
    .insert({
      client_id: clientId,
      kind,
      ei_data: { blocks: template?.blocks ?? [] },
    })
    .select(SELECT_FULL)
    .maybeSingle();
  if (!created) return null;
  return normalize(created as unknown as RawRow);
}
