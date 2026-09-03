"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember, hasFullAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";

/**
 * Escrita no banco de processos & tutoriais. Até aqui a tela era só
 * leitura — dava pra adicionar/editar processo só por SQL, o que contraria
 * a regra do projeto de tudo ser editável e ordenável pela interface.
 *
 * Conteúdo de processo é material da agência (não é dado de cliente), então
 * a regra é hasFullAccess: quem tem visão completa edita; "básico" lê.
 */

const AUDIENCIAS = ["equipe", "cliente"] as const;
type Audiencia = (typeof AUDIENCIAS)[number];

async function requireFullAccess(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) {
    redirect(`/admin/processos${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }
}

function campos(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || "geral";
  const audienciaRaw = String(formData.get("audiencia") ?? "equipe");
  const audiencia: Audiencia = AUDIENCIAS.includes(audienciaRaw as Audiencia)
    ? (audienciaRaw as Audiencia)
    : "equipe";
  const linkRaw = String(formData.get("link") ?? "").trim();
  // Link sem esquema vira https:// em vez de virar null silenciosamente.
  const link = linkRaw
    ? /^https?:\/\//i.test(linkRaw)
      ? linkRaw
      : `https://${linkRaw}`
    : null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  return { titulo, categoria, audiencia, link, descricao };
}

export async function createProcessDocAction(formData: FormData) {
  await requireFullAccess(formData);
  const { titulo, categoria, audiencia, link, descricao } = campos(formData);
  if (!titulo) return;

  const service = createSupabaseServiceRoleClient();
  // Entra no fim da audiência escolhida.
  const { data: ultimo } = await service
    .from("process_docs")
    .select("ordem")
    .eq("audiencia", audiencia)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = ((ultimo as { ordem: number } | null)?.ordem ?? 0) + 1;

  const { error } = await service.from("process_docs").insert({
    titulo,
    categoria,
    audiencia,
    link,
    descricao,
    ordem,
    fonte: "manual",
  });
  if (error) logServerError("processos.create", error);

  revalidatePath("/admin/processos");
}

export async function updateProcessDocAction(formData: FormData) {
  await requireFullAccess(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { titulo, categoria, audiencia, link, descricao } = campos(formData);
  if (!titulo) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("process_docs")
    .update({ titulo, categoria, audiencia, link, descricao })
    .eq("id", id);
  if (error) logServerError("processos.update", error);

  revalidatePath("/admin/processos");
}

export async function deleteProcessDocAction(formData: FormData) {
  await requireFullAccess(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("process_docs").delete().eq("id", id);
  if (error) logServerError("processos.delete", error);

  revalidatePath("/admin/processos");
}

/**
 * Move um item uma posição pra cima/baixo dentro da mesma audiência,
 * trocando o `ordem` com o vizinho.
 */
export async function moveProcessDocAction(formData: FormData) {
  await requireFullAccess(formData);
  const id = String(formData.get("id") ?? "");
  const direcao = String(formData.get("direcao") ?? "");
  if (!id || (direcao !== "cima" && direcao !== "baixo")) return;

  const service = createSupabaseServiceRoleClient();
  const { data: atual } = await service
    .from("process_docs")
    .select("id, ordem, audiencia")
    .eq("id", id)
    .maybeSingle();
  const item = atual as { id: string; ordem: number; audiencia: string } | null;
  if (!item) return;

  const { data: vizinhoData } = await service
    .from("process_docs")
    .select("id, ordem")
    .eq("audiencia", item.audiencia)
    [direcao === "cima" ? "lt" : "gt"]("ordem", item.ordem)
    .order("ordem", { ascending: direcao !== "cima" })
    .limit(1)
    .maybeSingle();
  const vizinho = vizinhoData as { id: string; ordem: number } | null;
  if (!vizinho) return;

  const [e1, e2] = await Promise.all([
    service.from("process_docs").update({ ordem: vizinho.ordem }).eq("id", item.id),
    service.from("process_docs").update({ ordem: item.ordem }).eq("id", vizinho.id),
  ]);
  if (e1.error || e2.error) {
    logServerError("processos.move", e1.error ?? e2.error);
  }

  revalidatePath("/admin/processos");
}
