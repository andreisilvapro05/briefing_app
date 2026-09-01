"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTemplateDocument } from "@/lib/ei-documents-server";

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Cria o documento de briefing de um cliente, duplicado do Modelo — mesmo
 * padrão de createEIDocumentAction (estruturas-iniciais/actions.ts), kind
 * "briefing" em vez de "ei". Idempotente: se o cliente já tem um, só
 * redireciona pra ele.
 */
export async function createBriefingDocumentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  if (!hasFullAccess(member)) {
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(clientId)) redirect(`/admin/briefing-documentos${keyParam(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();

  const { data: existing } = await service
    .from("ei_documents")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", "briefing")
    .maybeSingle();
  if (existing) {
    redirect(
      `/admin/briefing-documentos/${(existing as { id: string }).id}${keyParam(urlKey)}`
    );
  }

  const template = await getTemplateDocument("briefing");
  const blocks = template?.blocks ?? [];

  const { data: created } = await service
    .from("ei_documents")
    .insert({ client_id: clientId, kind: "briefing", ei_data: { blocks } })
    .select("id")
    .single();

  revalidatePath("/admin/briefing-documentos");
  revalidatePath(`/admin/${clientId}`);

  redirect(
    `/admin/briefing-documentos/${(created as { id: string }).id}${keyParam(urlKey)}`
  );
}
