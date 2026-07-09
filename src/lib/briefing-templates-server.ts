import { createSupabaseServiceRoleClient } from "./supabase/server";
import type {
  BriefingTemplate,
  TemplateQuestion,
} from "./briefing-templates";
import type { CustomQuestionTipo } from "./custom-questions";

/**
 * Leitura/normalização server-only dos templates de briefing (usa service-role).
 * Separado de `briefing-templates.ts` (client-safe) pra não arrastar o cliente
 * Supabase server pro bundle dos client components.
 */

function normalizeTipo(v: unknown): CustomQuestionTipo {
  return v === "texto-curto" || v === "escolha" ? v : "texto-longo";
}

function normalizeOpcoes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return [];
}

/** Normaliza uma pergunta vinda do jsonb `perguntas`. Tolerante a lixo. */
function normalizeQuestion(raw: unknown, index: number): TemplateQuestion {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? `q-${index}`),
    label: String(row.label ?? ""),
    hint: (row.hint as string | null) ?? null,
    tipo: normalizeTipo(row.tipo),
    opcoes: normalizeOpcoes(row.opcoes),
    ordem: Number(row.ordem ?? index),
  };
}

/** Normaliza uma linha da tabela briefing_templates. */
function normalizeTemplate(row: Record<string, unknown>): BriefingTemplate {
  const perguntasRaw = Array.isArray(row.perguntas) ? row.perguntas : [];
  const perguntas = perguntasRaw
    .map((q, i) => normalizeQuestion(q, i))
    .sort((a, b) => a.ordem - b.ordem);
  return {
    id: String(row.id),
    nome: String(row.nome ?? "Sem nome"),
    perguntas,
    created_at: String(row.created_at ?? ""),
  };
}

/** Lista todos os templates de briefing (mais recentes primeiro). */
export async function listBriefingTemplates(): Promise<BriefingTemplate[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("briefing_templates")
    .select("*")
    .order("created_at", { ascending: false });
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeTemplate);
}

/** Busca um template pelo id. Retorna null se não existir. */
export async function getBriefingTemplate(
  id: string
): Promise<BriefingTemplate | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("briefing_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return normalizeTemplate(data as Record<string, unknown>);
}
