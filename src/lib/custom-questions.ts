import { createSupabaseServiceRoleClient } from "./supabase/server";

/**
 * Perguntas específicas por cliente.
 *
 * O admin cadastra perguntas sob medida para um cliente; elas viram um bloco
 * extra no briefing dele. As respostas reusam `briefing_responses` com
 * field_id = `perguntas-especificas.<id-da-pergunta>`.
 */

export type CustomQuestionTipo = "texto-curto" | "texto-longo" | "escolha";

export const CUSTOM_TIPOS: { value: CustomQuestionTipo; label: string }[] = [
  { value: "texto-longo", label: "Texto longo" },
  { value: "texto-curto", label: "Texto curto" },
  { value: "escolha", label: "Múltipla escolha" },
];

export interface CustomQuestion {
  id: string;
  client_id: string;
  label: string;
  hint: string | null;
  tipo: CustomQuestionTipo;
  opcoes: string[];
  ordem: number;
  created_at: string;
}

/** Versão enxuta enviada ao cliente (sem client_id/created_at/ordem). */
export interface CustomQuestionPublic {
  id: string;
  label: string;
  hint: string | null;
  tipo: CustomQuestionTipo;
  opcoes: string[];
}

export const CUSTOM_BLOCO_ID = "perguntas-especificas";
export const CUSTOM_BLOCO_TITULO = "Perguntas específicas do seu projeto";

/** field_id usado ao salvar a resposta de uma pergunta custom. */
export function customFieldId(questionId: string): string {
  return `${CUSTOM_BLOCO_ID}.${questionId}`;
}

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
