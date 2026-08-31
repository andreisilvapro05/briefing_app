"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTemplateDocument } from "@/lib/ei-documents-server";

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Cria o documento de um cliente, duplicado do Modelo. Idempotente: se o
 * cliente já tem um documento, só redireciona pra ele (evita duplicar se
 * o admin clicar duas vezes).
 */
export async function createEIDocumentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();

  const { data: existing } = await service
    .from("ei_documents")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", "ei")
    .maybeSingle();
  if (existing) {
    redirect(
      `/admin/estruturas-iniciais/${(existing as { id: string }).id}${keyParam(urlKey)}`
    );
  }

  const template = await getTemplateDocument("ei");
  const blocks = template?.blocks ?? [];

  const { data: created } = await service
    .from("ei_documents")
    .insert({ client_id: clientId, kind: "ei", ei_data: { blocks } })
    .select("id")
    .single();

  revalidatePath("/admin/estruturas-iniciais");
  revalidatePath(`/admin/${clientId}`);

  redirect(
    `/admin/estruturas-iniciais/${(created as { id: string }).id}${keyParam(urlKey)}`
  );
}

/**
 * Autosave: grava os blocos inteiros de um documento (Modelo ou cliente).
 * Disparado debounced a cada mudança no editor (ver EIBlockEditor).
 */
export async function updateEIDocumentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const docId = String(formData.get("docId") ?? "");
  if (!docId) return;

  const raw = String(formData.get("eiJson") ?? "").trim();
  if (!raw) return;

  let parsed: { blocks: unknown[] };
  try {
    parsed = JSON.parse(raw) as { blocks: unknown[] };
  } catch {
    return;
  }

  const service = createSupabaseServiceRoleClient();
  await service
    .from("ei_documents")
    .update({ ei_data: parsed, updated_at: new Date().toISOString() })
    .eq("id", docId);

  revalidatePath(`/admin/estruturas-iniciais/${docId}`);
}
