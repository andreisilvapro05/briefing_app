import { createSupabaseServiceRoleClient } from "./supabase/server";
import type { ContentCard, ContentColumn } from "./content-board";

/**
 * Leitura server-only do quadro de conteúdo (colunas + cartões aninhados).
 * Usa service-role. Tolerante a tabela vazia.
 */
export async function listContentBoard(): Promise<ContentColumn[]> {
  const service = createSupabaseServiceRoleClient();

  const [{ data: colsData }, { data: cardsData }] = await Promise.all([
    service
      .from("content_columns")
      .select("id, titulo, ordem")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true }),
    service
      .from("content_cards")
      .select("id, column_id, titulo, descricao, ordem, imagens")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const cards: ContentCard[] = (
    (cardsData as Record<string, unknown>[] | null) ?? []
  ).map((row) => ({
    id: String(row.id),
    column_id: String(row.column_id),
    titulo: String(row.titulo ?? ""),
    descricao: (row.descricao as string | null) ?? null,
    ordem: Number(row.ordem ?? 0),
    imagens: Array.isArray(row.imagens)
      ? (row.imagens as unknown[]).map((x) => String(x)).filter(Boolean)
      : [],
  }));
  const byColumn = new Map<string, ContentCard[]>();
  for (const c of cards) {
    const list = byColumn.get(c.column_id) ?? [];
    list.push(c);
    byColumn.set(c.column_id, list);
  }

  return ((colsData as { id: string; titulo: string; ordem: number }[] | null) ??
    []).map((col) => ({
    id: col.id,
    titulo: col.titulo,
    ordem: col.ordem,
    cards: byColumn.get(col.id) ?? [],
  }));
}
