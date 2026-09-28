"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  isDeveloper,
  telaInicialDe,
  getCurrentMember,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";

/**
 * Documentos em branco — "uma parte pra anotar coisas, por exemplo pra
 * criar uma copy nova" (Karine, 27/09).
 *
 * Diferença pros outros dois tipos: não duplica Modelo nenhum e não exige
 * cliente. Nasce vazio e com nome editável, como um doc do ClickUp.
 */

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/** Só quem tem acesso completo — nota não é escopada por cliente. */
async function exigirAcesso(urlKey: string | null) {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (isDeveloper(member) || !hasFullAccess(member)) {
    redirect(`${telaInicialDe(member)}${keyParam(urlKey)}`);
  }
  return member;
}

export async function criarNotaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("ei_documents")
    .insert({
      kind: "nota",
      // Nome provisório: o documento abre já renomeável, e um "Sem título"
      // na lista é melhor que um campo vazio bloqueando a criação.
      nome: "Sem título",
      is_template: false,
      ei_data: { blocks: [] },
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("notas.criar", error);
    redirect(`/admin/notas${keyParam(urlKey)}`);
  }

  revalidatePath("/admin/notas");
  redirect(`/admin/notas/${(data as { id: string }).id}${keyParam(urlKey)}`);
}

/** Renomear — o nome é a única coisa que o editor de blocos não guarda. */
export async function renomearDocumentoAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);

  const docId = String(formData.get("docId") ?? "");
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 200);
  if (!docId || !nome) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({ nome, updated_at: new Date().toISOString() })
    .eq("id", docId);
  if (error) logServerError("notas.renomear", error);

  revalidatePath("/admin/notas");
  revalidatePath(`/admin/notas/${docId}`);
}

export async function apagarNotaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);

  const docId = String(formData.get("docId") ?? "");
  if (!docId) return;

  const service = createSupabaseServiceRoleClient();
  // Só apaga nota: a mesma tabela guarda EI e briefing, e um docId de outro
  // tipo chegando aqui não pode virar exclusão.
  const { error } = await service
    .from("ei_documents")
    .delete()
    .eq("id", docId)
    .eq("kind", "nota");
  if (error) logServerError("notas.apagar", error);

  revalidatePath("/admin/notas");
  redirect(`/admin/notas${keyParam(urlKey)}`);
}
