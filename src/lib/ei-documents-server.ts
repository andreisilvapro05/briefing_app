import { createSupabaseServiceRoleClient } from "./supabase/server";
import { emptyEI, type EIData } from "./ei-template";
import {
  eiDocumentTitle,
  type EIDocument,
  type EIDocumentClientInfo,
  type EIDocumentSummary,
} from "./ei-documents";

interface RawRow {
  id: string;
  client_id: string | null;
  nome: string | null;
  is_template: boolean;
  ei_data: EIData | null;
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
    nome: row.nome,
    eiData: row.ei_data ?? emptyEI(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client: clientInfo(row),
  };
}

const CLIENT_COLS = "id, nome, empresa, fysi_drive_link, cliente_drive_link";
const SELECT_FULL = `id, client_id, nome, is_template, ei_data, created_at, updated_at, clients(${CLIENT_COLS})`;

/** Lista todos os documentos pra sidebar do hub — Modelo primeiro, depois alfabético. */
export async function listEIDocuments(): Promise<EIDocumentSummary[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(`id, client_id, nome, is_template, updated_at, clients(${CLIENT_COLS})`);

  const rows = ((data as unknown as RawRow[]) ?? []).map((r) => ({
    id: r.id,
    title: eiDocumentTitle({ isTemplate: r.is_template, nome: r.nome, client: clientInfo(r) }),
    isTemplate: r.is_template,
    clientId: r.client_id,
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

export async function getTemplateDocument(): Promise<EIDocument | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(SELECT_FULL)
    .eq("is_template", true)
    .maybeSingle();
  if (!data) return null;
  return normalize(data as unknown as RawRow);
}

export async function getClientEIDocumentId(clientId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Clientes que ainda não têm documento — pra popular o seletor de criação. */
export async function listClientsWithoutEIDocument(): Promise<
  { id: string; nome: string | null; empresa: string | null }[]
> {
  const service = createSupabaseServiceRoleClient();
  const { data: docs } = await service
    .from("ei_documents")
    .select("client_id")
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
