"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
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
/**
 * Modelo de briefing é config GLOBAL da agência: um modelo apagado some da
 * ficha de todo cliente. `getAdminUser` aceitava qualquer membro logado,
 * inclusive o papel "basico" (designer) — que não deveria nem ver a tela.
 */
async function requireAcessoTotal(urlKey: string | null) {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) {
    redirect(`/admin/briefings${keySuffix(urlKey)}`);
  }
  return member;
}

export async function createBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await requireAcessoTotal(urlKey);
  void member;

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
  const member = await requireAcessoTotal(urlKey);
  void member;

  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;

  const perguntas = parsePerguntas(String(formData.get("perguntas") ?? "[]"));

  const service = createSupabaseServiceRoleClient();
  const { error: updErr } = await service
    .from("briefing_templates")
    .update({ nome, perguntas, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) logServerError("briefings.template.update", updErr);

  revalidatePath("/admin/briefings");
  revalidatePath(`/admin/briefings/${id}`);
}

/**
 * Remove um template. Não afeta perguntas já aplicadas a clientes (aquelas
 * já foram copiadas pra client_custom_questions).
 */
export async function deleteBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await requireAcessoTotal(urlKey);
  void member;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  const { error: delErr } = await service
    .from("briefing_templates")
    .delete()
    .eq("id", id);
  if (delErr) logServerError("briefings.template.delete", delErr);

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
  // requireAcessoTotal já exige sessão E acesso completo. O escopo por
  // cliente abaixo é redundante pra quem passa dali (acesso completo vê
  // tudo), mas fica como cinto e suspensório — e sem o `if (quem)` de
  // antes, que parecia deixar passar sem sessão e confundia quem lia.
  const member = await requireAcessoTotal(urlKey);

  const templateId = String(formData.get("templateId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!templateId || !clientId) return;

  const visiveis = await getVisibleClientIds(member);
  if (visiveis && !visiveis.has(clientId)) {
    redirect(`/admin/briefings${keySuffix(urlKey)}`);
  }

  const template = await getBriefingTemplate(templateId);
  if (!template || template.perguntas.length === 0) {
    redirect(`/admin/briefings/${templateId}${keySuffix(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();

  // Anexa DEPOIS das perguntas específicas que o cliente já tenha. Usa
  // (maior ordem existente) + 1 em vez de count — porque delete não renumera
  // e deixa buracos, então count subestimaria a ordem e intercalaria as novas
  // perguntas no meio do briefing.
  const { data: maxRow } = await service
    .from("client_custom_questions")
    .select("ordem")
    .eq("client_id", clientId)
    .order("ordem", { ascending: false })
    .limit(1);
  const offset =
    (Array.isArray(maxRow) && maxRow.length
      ? Number((maxRow[0] as { ordem: number }).ordem ?? -1)
      : -1) + 1;

  const rows = template!.perguntas.map((q, i) => ({
    client_id: clientId,
    label: q.label,
    hint: q.hint,
    tipo: q.tipo,
    opcoes: q.opcoes,
    ordem: offset + i,
  }));

  const { error: insErr } = await service
    .from("client_custom_questions")
    .insert(rows);
  if (insErr) logServerError("briefings.aplicar-template", insErr);

  revalidatePath(`/admin/${clientId}`);
  redirect(`/admin/${clientId}${keySuffix(urlKey)}#briefing`);
}

// ---------------------------------------------------------------------------
// Briefing como documento próprio: importação do ClickUp e link público.
// Pedido do usuário 2026-09-20.
// ---------------------------------------------------------------------------

/**
 * Puxa as páginas do doc de briefings do ClickUp pro app, fiel ao conteúdo
 * (caixinhas marcadas, links, divisores). Idempotente: rodar de novo
 * atualiza o que mudou lá em vez de duplicar.
 */
export async function importarBriefingsAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { importarBriefingsDoClickUp } = await import("@/lib/briefings-server");
  const r = await importarBriefingsDoClickUp();

  const sp = new URLSearchParams();
  if (urlKey) sp.set("key", urlKey);
  if (!r.ok) {
    logServerError("importarBriefingsAction", new Error(r.reason ?? "falhou"));
    sp.set("imp", "erro");
    if (r.reason) sp.set("motivo", r.reason);
  } else {
    sp.set("imp", "ok");
    sp.set(
      "res",
      [r.criados, r.atualizados, r.semCliente, r.credenciaisProtegidas].join("-")
    );
  }
  revalidatePath("/admin/briefings");
  redirect(`/admin/briefings?${sp.toString()}`);
}

/** Liga o link público do briefing (token próprio, não o magic_slug). */
export async function compartilharBriefingAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = (formData.get("id") as string | null) ?? "";
  const dias = Number(formData.get("dias") ?? "");
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Criar link público é decisão de quem tem visão completa — não do papel
  // "basico", que é justamente de quem o briefing deve ficar separado.
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { ativarCompartilhamento } = await import("@/lib/briefings-server");
  const r = await ativarCompartilhamento(id, {
    expiraEmDias: Number.isFinite(dias) && dias > 0 ? dias : null,
  });
  if ("erro" in r) logServerError("compartilharBriefingAction", new Error(r.erro));

  revalidatePath(`/admin/briefings/doc/${id}`);
  redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
}

/** Revoga o link. Troca o token: o link antigo não volta a valer. */
export async function revogarCompartilhamentoAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = (formData.get("id") as string | null) ?? "";
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { revogarCompartilhamento } = await import("@/lib/briefings-server");
  await revogarCompartilhamento(id);

  revalidatePath(`/admin/briefings/doc/${id}`);
  redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
}

/** Vincula (ou desvincula) o briefing avulso a um cliente. */
export async function vincularBriefingAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = (formData.get("id") as string | null) ?? "";
  const clientId = ((formData.get("clientId") as string | null) ?? "").trim();
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { vincularBriefingACliente } = await import("@/lib/briefings-server");
  await vincularBriefingACliente(id, clientId || null);

  revalidatePath(`/admin/briefings/doc/${id}`);
  redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
}
