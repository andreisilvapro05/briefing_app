"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember, hasFullAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Metas e planejamento de marketing incluem alvos de faturamento — dado
 * comercial. Exige visão completa (admin/avançado), não só "estar logado"
 * (o nome antigo `requireAdmin` mentia: aceitava qualquer membro).
 */
async function requireFullAccess(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }
}

/** Cria uma meta/indicador pro mês de referência. */
export async function createGoalAction(formData: FormData) {
  await requireFullAccess(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  const mes = String(formData.get("mesReferencia") ?? "").trim();
  if (!titulo || !mes) return;

  const meta = Number(String(formData.get("meta") ?? "0").replace(",", "."));
  const unidade = String(formData.get("unidade") ?? "").trim() || null;

  const service = createSupabaseServiceRoleClient();
  await service.from("marketing_goals").insert({
    titulo,
    meta: Number.isFinite(meta) ? meta : 0,
    unidade,
    mes_referencia: mes,
  });

  revalidatePath("/admin/marketing/metas");
}

/** Atualiza o valor atual de uma meta (progresso). */
export async function updateGoalAtualAction(formData: FormData) {
  await requireFullAccess(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const atual = Number(String(formData.get("atual") ?? "0").replace(",", "."));

  const service = createSupabaseServiceRoleClient();
  await service
    .from("marketing_goals")
    .update({ atual: Number.isFinite(atual) ? atual : 0, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/marketing/metas");
}

/** Remove uma meta. */
export async function deleteGoalAction(formData: FormData) {
  await requireFullAccess(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("marketing_goals").delete().eq("id", id);

  revalidatePath("/admin/marketing/metas");
}

/** Cria um item de planejamento pro mês de referência. */
export async function createPlanoItemAction(formData: FormData) {
  await requireFullAccess(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  const mes = String(formData.get("mesReferencia") ?? "").trim();
  if (!titulo || !mes) return;

  const descricao = String(formData.get("descricao") ?? "").trim() || null;

  const service = createSupabaseServiceRoleClient();
  await service.from("marketing_plano_itens").insert({
    titulo,
    descricao,
    mes_referencia: mes,
  });

  revalidatePath("/admin/marketing/planejamento");
}

/** Muda o status de um item de planejamento (planejado/em-andamento/feito). */
export async function setPlanoItemStatusAction(formData: FormData) {
  await requireFullAccess(formData);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["planejado", "em-andamento", "feito"].includes(status)) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("marketing_plano_itens")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/marketing/planejamento");
}

/** Remove um item de planejamento. */
export async function deletePlanoItemAction(formData: FormData) {
  await requireFullAccess(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("marketing_plano_itens").delete().eq("id", id);

  revalidatePath("/admin/marketing/planejamento");
}
