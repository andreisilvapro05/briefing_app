import { CUSTOM_BLOCO_ID, type CustomQuestion } from "./custom-questions";

/**
 * Quais perguntas específicas o cliente JÁ respondeu — e quais faltam.
 *
 * Karine (04/10): "a parte de questões pendentes para o cliente precisa ser
 * mais simples, estilo checklist".
 *
 * O que havia não era checklist e nem sabia o que estava pendente: cada
 * pergunta era um cartão com quatro campos de formulário (Pergunta, Ajuda,
 * Tipo de resposta, Opções), o bloco "Nova pergunta" ficava sempre aberto, e
 * **não existia estado respondida/pendente em lugar nenhum** — as respostas
 * moram em `briefing_responses` e só eram lidas pra rotular o texto das
 * respostas, nunca pra dizer o que falta. "Questões pendentes" quer dizer
 * exatamente isso, e era a única coisa que a tela não mostrava.
 */

export interface PerguntaNaLista {
  pergunta: CustomQuestion;
  respondida: boolean;
  /** O que o cliente respondeu, em uma linha, pra ler sem abrir nada. */
  resumo: string | null;
}

export interface ContagemPendentes {
  total: number;
  respondidas: number;
  pendentes: number;
}

/**
 * Uma resposta conta como VAZIA quando não tem conteúdo de verdade.
 *
 * O cliente que abre o briefing e passa pelo bloco sem escrever grava `""`;
 * uma pergunta de múltipla escolha sem marcar nada grava `[]`. Tratar esses
 * como "respondida" era o jeito mais fácil de a tela mentir — e é justamente
 * o que ela precisa acusar.
 */
export function respostaVazia(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) {
    return valor.every((v) => respostaVazia(v));
  }
  if (typeof valor === "object") {
    return Object.keys(valor as object).length === 0;
  }
  return false;
}

/** Texto de uma linha pra qualquer formato de resposta. */
export function resumoDaResposta(valor: unknown): string | null {
  if (respostaVazia(valor)) return null;
  if (typeof valor === "string") return valor.trim();
  if (Array.isArray(valor)) {
    const itens = valor
      .filter((v) => !respostaVazia(v))
      .map((v) => (typeof v === "string" ? v.trim() : String(v)));
    return itens.length > 0 ? itens.join(" · ") : null;
  }
  if (typeof valor === "number" || typeof valor === "boolean") {
    return String(valor);
  }
  return null;
}

/**
 * Junta as perguntas com as respostas do briefing.
 *
 * `respostas` é o mapa `field_id -> value` do bloco de perguntas
 * específicas. O `field_id` é `perguntas-especificas.<id>` — ver
 * custom-questions.ts.
 */
export function montarPerguntas(
  perguntas: CustomQuestion[],
  respostas: Map<string, unknown>
): PerguntaNaLista[] {
  return perguntas.map((pergunta) => {
    const valor = respostas.get(`${CUSTOM_BLOCO_ID}.${pergunta.id}`);
    const resumo = resumoDaResposta(valor);
    return { pergunta, respondida: resumo !== null, resumo };
  });
}

export function contar(lista: PerguntaNaLista[]): ContagemPendentes {
  const respondidas = lista.filter((p) => p.respondida).length;
  return {
    total: lista.length,
    respondidas,
    pendentes: lista.length - respondidas,
  };
}

/** "faltam 3 de 8" / "tudo respondido (8)" — a linha do cabeçalho. */
export function fraseDasPerguntas(c: ContagemPendentes): string {
  if (c.total === 0) return "Nenhuma pergunta específica ainda";
  if (c.pendentes === 0) return `Tudo respondido (${c.total})`;
  return `${c.pendentes === 1 ? "falta 1" : `faltam ${c.pendentes}`} de ${c.total}`;
}
