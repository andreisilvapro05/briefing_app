import { createSupabaseServiceRoleClient } from "./supabase/server";

/**
 * Perguntas específicas por cliente.
 *
 * O admin cadastra perguntas sob medida para um cliente; elas viram um bloco
 * extra no briefing dele. As respostas reusam `briefing_responses` com
 * field_id = `perguntas-especificas.<id-da-pergunta>`.
 */

export interface CustomQuestion {
  id: string;
  client_id: string;
  label: string;
  hint: string | null;
  ordem: number;
  created_at: string;
}

/** Versão enxuta enviada ao cliente (sem client_id/created_at). */
export interface CustomQuestionPublic {
  id: string;
  label: string;
  hint: string | null;
}

export const CUSTOM_BLOCO_ID = "perguntas-especificas";
export const CUSTOM_BLOCO_TITULO = "Perguntas específicas do seu projeto";

/** field_id usado ao salvar a resposta de uma pergunta custom. */
export function customFieldId(questionId: string): string {
  return `${CUSTOM_BLOCO_ID}.${questionId}`;
}

/** Lista as perguntas custom de um cliente (ordenadas). Usa service-role. */
export async function listCustomQuestions(
  clientId: string
): Promise<CustomQuestion[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("client_custom_questions")
    .select("id, client_id, label, hint, ordem, created_at")
    .eq("client_id", clientId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as CustomQuestion[]) ?? [];
}
