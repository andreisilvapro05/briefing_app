"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { CustomQuestionTipo } from "@/lib/custom-questions";
import type { TemplateQuestion } from "@/lib/briefing-templates";
import { getBriefingTemplate } from "@/lib/briefing-templates-server";

/**
 * Ações da aba global "Briefings" — templates reutilizáveis.
 *
 * Um template é um conjunto de perguntas guardado em briefing_templates
 * (perguntas: jsonb). "Aplicar a um cliente" copia essas perguntas pra
 * client_custom_questions do cliente, que já é renderizado no briefing dele.
 */

function keySuffix(urlKey: string | null): string {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

function normalizeTipo(v: unknown): CustomQuestionTipo {
  return v === "texto-curto" || v === "escolha" ? v : "texto-longo";
}

/** Sanitiza o array de perguntas vindo do builder (JSON no FormData). */
function parsePerguntas(raw: string): TemplateQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item, i): TemplateQuestion | null => {
      const row = (item ?? {}) as Record<string, unknown>;
      const label = String(row.label ?? "").trim();
      if (!label) return null;
      const tipo = normalizeTipo(row.tipo);
      const opcoes =
        tipo === "escolha" && Array.isArray(row.opcoes)
          ? row.opcoes.map((o) => String(o).trim()).filter(Boolean)
          : [];
      const hint = String(row.hint ?? "").trim();
      return {
        id: String(row.id ?? `q-${i}`),
        label,
        hint: hint || null,
        tipo,
        opcoes,
        ordem: i,
      };
    })
    .filter((q): q is TemplateQuestion => q !== null);
}

/**
 * Cria um template vazio (só nome) e leva pro builder pra montar as perguntas.
 */
export async function createBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;

  const service = createSupabaseServiceRoleClient();
  const { data: created } = await service
    .from("briefing_templates")
    .insert({ nome, perguntas: [] })
    .select("id")
    .single();

  revalidatePath("/admin/briefings");
  if (created?.id) {
    redirect(`/admin/briefings/${created.id}${keySuffix(urlKey)}`);
  }
  redirect(`/admin/briefings${keySuffix(urlKey)}`);
}

/**
 * Salva nome + perguntas do template (o builder manda o array inteiro em JSON).
 */
export async function saveBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;

  const perguntas = parsePerguntas(String(formData.get("perguntas") ?? "[]"));

  const service = createSupabaseServiceRoleClient();
  await service
    .from("briefing_templates")
    .update({ nome, perguntas, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/briefings");
  revalidatePath(`/admin/briefings/${id}`);
}

/**
 * Remove um template. Não afeta perguntas já aplicadas a clientes (aquelas
 * já foram copiadas pra client_custom_questions).
 */
export async function deleteBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("briefing_templates").delete().eq("id", id);

  revalidatePath("/admin/briefings");
  redirect(`/admin/briefings${keySuffix(urlKey)}`);
}

/**
 * Aplica um template a um cliente: copia cada pergunta do template pra
 * client_custom_questions daquele cliente (anexando depois das que já existem).
 * Depois disso, as perguntas viram o bloco extra no briefing do cliente.
 *
 * Redireciona pro cliente (aba briefing) pra o admin ver o resultado.
 */
export async function applyTemplateToClientAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const templateId = String(formData.get("templateId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!templateId || !clientId) return;

  const template = await getBriefingTemplate(templateId);
  if (!template || template.perguntas.length === 0) {
    redirect(`/admin/briefings/${templateId}${keySuffix(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();

  // Anexa depois das perguntas específicas que o cliente já tenha.
  const { count } = await service
    .from("client_custom_questions")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);
  const offset = count ?? 0;

  const rows = template!.perguntas.map((q, i) => ({
    client_id: clientId,
    label: q.label,
    hint: q.hint,
    tipo: q.tipo,
    opcoes: q.opcoes,
    ordem: offset + i,
  }));

  await service.from("client_custom_questions").insert(rows);

  revalidatePath(`/admin/${clientId}`);
  redirect(`/admin/${clientId}${keySuffix(urlKey)}#briefing`);
}
