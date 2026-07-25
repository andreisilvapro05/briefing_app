"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { DEFAULT_CONTENT_COLUMNS } from "@/lib/content-board";

/**
 * Ações do quadro de produção de conteúdo (kanban único da Fysi).
 * Colunas editáveis + cartões que se movem entre colunas via menu.
 */

const PATH = "/admin/conteudo";

async function guard(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");
  return createSupabaseServiceRoleClient();
}

/**
 * Próxima `ordem` = (maior ordem existente) + 1. Usar isso em vez de count
 * evita colisões quando há buracos (delete não renumera), que fariam o item
 * novo aparecer fora de lugar ao recarregar.
 */
async function nextOrdem(
  service: Awaited<ReturnType<typeof guard>>,
  table: "content_columns" | "content_cards",
  columnId?: string
): Promise<number> {
  let q = service
    .from(table)
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1);
  if (columnId) q = q.eq("column_id", columnId);
  const { data } = await q;
  const max =
    Array.isArray(data) && data.length
      ? Number((data[0] as { ordem: number }).ordem ?? -1)
      : -1;
  return max + 1;
}

/** Semeia colunas de exemplo (só quando o quadro está vazio). */
export async function seedDefaultColumnsAction(
  formData: FormData
): Promise<{ id: string; titulo: string; ordem: number }[]> {
  const service = await guard(formData);

  const { count } = await service
    .from("content_columns")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return [];

  const rows = DEFAULT_CONTENT_COLUMNS.map((titulo, i) => ({
    titulo,
    ordem: i,
  }));
  const { data } = await service
    .from("content_columns")
    .insert(rows)
    .select("id, titulo, ordem")
    .order("ordem", { ascending: true });
  revalidatePath(PATH);
  return (data as { id: string; titulo: string; ordem: number }[] | null) ?? [];
}

export async function addColumnAction(
  formData: FormData
): Promise<{ id: string; titulo: string; ordem: number } | null> {
  const service = await guard(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return null;

  const ordem = await nextOrdem(service, "content_columns");
  const { data } = await service
    .from("content_columns")
    .insert({ titulo, ordem })
    .select("id, titulo, ordem")
    .single();
  revalidatePath(PATH);
  return (data as { id: string; titulo: string; ordem: number } | null) ?? null;
}

export async function renameColumnAction(formData: FormData) {
  const service = await guard(formData);
  const columnId = String(formData.get("columnId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!columnId || !titulo) return;

  await service
    .from("content_columns")
    .update({ titulo })
    .eq("id", columnId);
  revalidatePath(PATH);
}

export async function deleteColumnAction(formData: FormData) {
  const service = await guard(formData);
  const columnId = String(formData.get("columnId") ?? "");
  if (!columnId) return;

  // Cartões saem junto (ON DELETE CASCADE).
  await service.from("content_columns").delete().eq("id", columnId);
  revalidatePath(PATH);
}

/** Move a coluna pra esquerda/direita (troca ordem com a vizinha). */
export async function moveColumnAction(formData: FormData) {
  const service = await guard(formData);
  const columnId = String(formData.get("columnId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!columnId || (direction !== "left" && direction !== "right")) return;

  const { data } = await service
    .from("content_columns")
    .select("id, ordem")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  const list = (data as { id: string; ordem: number }[] | null) ?? [];
  const idx = list.findIndex((c) => c.id === columnId);
  if (idx === -1) return;
  const swap = direction === "left" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= list.length) return;

  const reordered = [...list];
  [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
  for (let i = 0; i < reordered.length; i++) {
    if (reordered[i].ordem !== i) {
      await service
        .from("content_columns")
        .update({ ordem: i })
        .eq("id", reordered[i].id);
    }
  }
  revalidatePath(PATH);
}

export async function addCardAction(
  formData: FormData
): Promise<{ id: string } | null> {
  const service = await guard(formData);
  const columnId = String(formData.get("columnId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!columnId || !titulo) return null;

  const { data } = await service
    .from("content_cards")
    .insert({
      column_id: columnId,
      titulo,
      ordem: await nextOrdem(service, "content_cards", columnId),
    })
    .select("id")
    .single();
  revalidatePath(PATH);
  return (data as { id: string } | null) ?? null;
}

export async function updateCardAction(formData: FormData) {
  const service = await guard(formData);
  const cardId = String(formData.get("cardId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!cardId || !titulo) return;

  await service
    .from("content_cards")
    .update({
      titulo,
      descricao: descricao || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);
  revalidatePath(PATH);
}

/** Move o cartão pro fim da coluna de destino. */
export async function moveCardAction(formData: FormData) {
  const service = await guard(formData);
  const cardId = String(formData.get("cardId") ?? "");
  const targetColumnId = String(formData.get("targetColumnId") ?? "");
  if (!cardId || !targetColumnId) return;

  await service
    .from("content_cards")
    .update({
      column_id: targetColumnId,
      ordem: await nextOrdem(service, "content_cards", targetColumnId),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);
  revalidatePath(PATH);
}

/** Salva o array de imagens (URLs) de um cartão. */
export async function setCardImagesAction(formData: FormData) {
  const service = await guard(formData);
  const cardId = String(formData.get("cardId") ?? "");
  if (!cardId) return;

  let imagens: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("imagens") ?? "[]"));
    if (Array.isArray(parsed)) {
      imagens = parsed
        .map((x) => String(x))
        .filter((u) => /^https?:\/\//i.test(u))
        .slice(0, 20);
    }
  } catch {
    return;
  }

  await service
    .from("content_cards")
    .update({ imagens, updated_at: new Date().toISOString() })
    .eq("id", cardId);
  revalidatePath(PATH);
}

export async function deleteCardAction(formData: FormData) {
  const service = await guard(formData);
  const cardId = String(formData.get("cardId") ?? "");
  if (!cardId) return;

  await service.from("content_cards").delete().eq("id", cardId);
  revalidatePath(PATH);
}
