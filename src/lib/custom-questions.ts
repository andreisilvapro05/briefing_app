/**
 * Perguntas específicas por cliente — tipos e constantes CLIENT-SAFE.
 *
 * Este módulo NÃO importa nada de server (ex: supabase/server), pra poder ser
 * importado tanto por client components quanto por server. A função que lê o
 * banco (usa service-role) fica em `custom-questions-server.ts`.
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
