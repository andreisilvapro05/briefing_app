import { createSupabaseServiceRoleClient } from "./supabase/server";
import type { CustomQuestion, CustomQuestionTipo } from "./custom-questions";

/**
 * Leitura server-only das perguntas específicas (usa service-role).
 * Separado de `custom-questions.ts` pra não arrastar o cliente Supabase
 * server pro bundle dos client components (quebrava o build).
 */

function normalizeTipo(v: unknown): CustomQuestionTipo {
  return v === "texto-curto" || v === "escolha" ? v : "texto-longo";
}

function normalizeOpcoes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return [];
}

/**
 * Normaliza uma linha do banco. Tolerante: se as colunas tipo/opcoes ainda
 * não existirem (migration não aplicada), aplica defaults sem quebrar.
 */
function normalizeQuestion(row: Record<string, unknown>): CustomQuestion {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    label: String(row.label ?? ""),
    hint: (row.hint as string | null) ?? null,
    tipo: normalizeTipo(row.tipo),
    opcoes: normalizeOpcoes(row.opcoes),
    ordem: Number(row.ordem ?? 0),
    created_at: String(row.created_at ?? ""),
  };
}

/** Lista as perguntas custom de um cliente (ordenadas). Usa service-role. */
export async function listCustomQuestions(
  clientId: string
): Promise<CustomQuestion[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("client_custom_questions")
    .select("*")
    .eq("client_id", clientId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeQuestion);
}
