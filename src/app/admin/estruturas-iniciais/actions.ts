"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  isDeveloper,
  telaInicialDe,
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
  // Desenvolvedor: tem tarefa no cliente e passaria no escopo, mas escrever
  // aqui não é dele. A tela ele não vê; a Server Action é POST direto.
  if (isDeveloper(member)) {
    redirect(
      `${telaInicialDe(member)}${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`
    );
  }

  const clientId = String(formData.get("clientId") ?? "");
  // `kind` permite reaproveitar esta action pro documento de Briefing: o
  // fluxo é o mesmo (clona o Modelo), só muda a tela de destino.
  const kind = formData.get("kind") === "briefing" ? "briefing" : "ei";
  const destino = (docId: string) =>
    kind === "briefing"
      ? `/admin/briefings/doc/${docId}${keyParam(urlKey)}`
      : `/admin/estruturas-iniciais/${docId}${keyParam(urlKey)}`;
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
    .eq("kind", kind)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) {
    redirect(destino((existing as { id: string }).id));
  }

  const template = await getTemplateDocument(kind);
  const blocks = template?.blocks ?? [];

  const { data: created, error } = await service
    .from("ei_documents")
    .insert({ client_id: clientId, kind, ei_data: { blocks } })
    .select("id")
    .single();
  if (error || !created) {
    logServerError("documento.criar", error ?? new Error("sem linha"));
    return;
  }

  revalidatePath("/admin/estruturas-iniciais");
  revalidatePath("/admin/briefings");
  revalidatePath(`/admin/${clientId}`);

  redirect(destino((created as { id: string }).id));
}

/**
 * Autosave: grava os blocos inteiros de um documento (Modelo ou cliente).
 * Disparado debounced a cada mudança no editor (ver EIBlockEditor).
 */
export async function updateEIDocumentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Desenvolvedor: tem tarefa no cliente e passaria no escopo, mas escrever
  // aqui não é dele. A tela ele não vê; a Server Action é POST direto.
  if (isDeveloper(member)) {
    redirect(
      `${telaInicialDe(member)}${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`
    );
  }

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
