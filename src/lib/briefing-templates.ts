import type { CustomQuestionTipo } from "./custom-questions";

/**
 * Templates de briefing reutilizáveis (client-safe: só tipos/constantes).
 * A equipe monta um template uma vez e aplica a vários clientes (copia as
 * perguntas pra client_custom_questions do cliente).
 */

export interface TemplateQuestion {
  id: string;
  label: string;
  hint: string | null;
  tipo: CustomQuestionTipo;
  opcoes: string[];
  ordem: number;
}

export interface BriefingTemplate {
  id: string;
  nome: string;
  perguntas: TemplateQuestion[];
  created_at: string;
}
