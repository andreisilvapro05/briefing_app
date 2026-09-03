"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
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
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  if (!hasFullAccess(member)) {
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(clientId)) redirect(`/admin/estruturas-iniciais${keyParam(urlKey)}`);
  }

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
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const docId = String(formData.get("docId") ?? "");
  if (!docId) return;

  const raw = String(formData.get("eiJson") ?? "").trim();
  if (!raw) return;

  let parsed: { blocks: unknown[] };
  try {
    parsed = JSON.parse(raw) as { blocks: unknown[] };
  } catch (err) {
    logServerError("ei.blocos-json-invalido", err);
    return;
  }

  const service = createSupabaseServiceRoleClient();

  if (!hasFullAccess(member)) {
    // Resolve o client_id REAL do documento (não confia em nada vindo do
    // form) — doc sem cliente é o Modelo, só admin/avancado edita esse.
    const { data: doc } = await service
      .from("ei_documents")
      .select("client_id")
      .eq("id", docId)
      .maybeSingle();
    const docClientId = (doc as { client_id: string | null } | null)
      ?.client_id;
    if (!docClientId) return;
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(docClientId)) return;
  }

  const { error: escritaErr1 } = await service
    .from("ei_documents")
    .update({ ei_data: parsed, updated_at: new Date().toISOString() })
    .eq("id", docId);
  if (escritaErr1) logServerError("ei.escrita", escritaErr1);

  revalidatePath(`/admin/estruturas-iniciais/${docId}`);
}
