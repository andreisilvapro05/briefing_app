import { randomBytes } from "node:crypto";
import type { PartialBlock } from "@blocknote/core";
import { createSupabaseServiceRoleClient } from "./supabase/server";
import { logServerError } from "./api-helpers";
import { situacaoDaCopy, type SituacaoCopy } from "./copy-documento";

/**
 * A copy do cliente — leitura e escrita server-only.
 *
 * Mora em `ei_documents` com `kind = 'copy'`: é o mesmo documento de
 * blocos da EI e do Briefing, com o mesmo editor e o mesmo link público
 * por token. Ver migration 20260930180000.
 */

const COLS =
  "id, client_id, nome, ei_data, share_token, share_enabled, share_expires_at, aprovado_em, ajuste_pedido_em, aprovacao_comentario, created_at, updated_at";

interface Row {
  id: string;
  client_id: string | null;
  nome: string | null;
  ei_data: { blocks?: unknown[] } | null;
  share_token: string | null;
  share_enabled: boolean;
  share_expires_at: string | null;
  aprovado_em: string | null;
  ajuste_pedido_em: string | null;
  aprovacao_comentario: string | null;
  created_at: string;
  updated_at: string;
}

export interface CopyDoCliente {
  id: string;
  clientId: string | null;
  blocks: PartialBlock[];
  shareToken: string | null;
  shareEnabled: boolean;
  aprovadoEm: string | null;
  ajustePedidoEm: string | null;
  comentario: string | null;
  situacao: SituacaoCopy;
  updatedAt: string;
}

function normalize(row: Row): CopyDoCliente {
  return {
    id: row.id,
    clientId: row.client_id,
    blocks: Array.isArray(row.ei_data?.blocks)
      ? (row.ei_data.blocks as PartialBlock[])
      : [],
    shareToken: row.share_token,
    shareEnabled: row.share_enabled,
    aprovadoEm: row.aprovado_em,
    ajustePedidoEm: row.ajuste_pedido_em,
    comentario: row.aprovacao_comentario,
    situacao: situacaoDaCopy({
      shareEnabled: row.share_enabled,
      aprovadoEm: row.aprovado_em,
      ajustePedidoEm: row.ajuste_pedido_em,
    }),
    updatedAt: row.updated_at,
  };
}

export async function obterCopyDoCliente(
  clientId: string
): Promise<CopyDoCliente | null> {
  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("ei_documents")
    .select(COLS)
    .eq("client_id", clientId)
    .eq("kind", "copy")
    .maybeSingle();
  if (error) {
    logServerError("copy.obter", error);
    return null;
  }
  return data ? normalize(data as unknown as Row) : null;
}

/**
 * Cria a copy do cliente. Idempotente: já existindo, devolve a que há.
 * O índice único no banco garante a regra mesmo em corrida.
 */
export async function criarCopy(
  clientId: string
): Promise<CopyDoCliente | null> {
  const jaTem = await obterCopyDoCliente(clientId);
  if (jaTem) return jaTem;

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("ei_documents")
    .insert({
      client_id: clientId,
      kind: "copy",
      // Começa com um parágrafo vazio: o editor de blocos não abre num
      // documento sem nenhum bloco — fica um retângulo morto que não
      // aceita clique.
      ei_data: { blocks: [{ type: "paragraph", content: [] }] },
    })
    .select(COLS)
    .single();
  if (error) {
    logServerError("copy.criar", error);
    return null;
  }
  return normalize(data as unknown as Row);
}

/** 32 hex = 128 bits. Mesmo tamanho do token do briefing. */
function novoToken(): string {
  return randomBytes(16).toString("hex");
}

export async function ativarLinkDaCopy(
  id: string
): Promise<{ token: string } | null> {
  const service = createSupabaseServiceRoleClient();
  const { data: atual } = await service
    .from("ei_documents")
    .select("share_token")
    .eq("id", id)
    .maybeSingle();
  const token =
    (atual as { share_token: string | null } | null)?.share_token || novoToken();
  const { error } = await service
    .from("ei_documents")
    .update({
      share_token: token,
      share_enabled: true,
      share_created_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    logServerError("copy.ativar-link", error);
    return null;
  }
  return { token };
}

/**
 * Desliga o link. O token NÃO é apagado: religar depois devolve o mesmo
 * endereço, que é o que a pessoa já mandou pro cliente no WhatsApp.
 */
export async function revogarLinkDaCopy(id: string): Promise<boolean> {
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({ share_enabled: false })
    .eq("id", id);
  if (error) {
    logServerError("copy.revogar-link", error);
    return false;
  }
  return true;
}

/**
 * A copy aberta pelo link público.
 *
 * Mesmas travas do briefing: revogado, expirado ou inexistente caem no
 * mesmo null — não se conta ao visitante que o documento existe.
 */
export async function obterCopyPorToken(
  token: string
): Promise<(CopyDoCliente & { cliente: string | null }) | null> {
  if (!token || token.length < 16) return null;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(`${COLS}, clients(nome, empresa)`)
    .eq("share_token", token)
    .eq("kind", "copy")
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row & {
    clients: { nome: string | null; empresa: string | null } | null;
  };
  if (!row.share_enabled) return null;
  if (row.share_expires_at && new Date(row.share_expires_at) < new Date()) {
    return null;
  }
  return {
    ...normalize(row),
    cliente: row.clients?.empresa?.trim() || row.clients?.nome || null,
  };
}

/**
 * A resposta do cliente, vinda do link público.
 *
 * Revalida o token em vez de confiar no id que veio do formulário: sem
 * isso, quem descobrisse um id de documento escreveria aprovação em
 * qualquer copy do sistema.
 */
export async function responderCopy(
  token: string,
  resposta: "aprovar" | "ajuste",
  comentario: string
): Promise<{ ok: true; clientId: string | null } | { ok: false }> {
  const doc = await obterCopyPorToken(token);
  if (!doc) return { ok: false };

  const agora = new Date().toISOString();
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({
      ...(resposta === "aprovar"
        ? { aprovado_em: agora }
        : { ajuste_pedido_em: agora }),
      aprovacao_comentario: comentario.trim().slice(0, 2000) || null,
    })
    .eq("id", doc.id);
  if (error) {
    logServerError("copy.responder", error);
    return { ok: false };
  }
  return { ok: true, clientId: doc.clientId };
}
