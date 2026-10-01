/**
 * Em que pé está a copy de um cliente.
 *
 * Karine (26/09), item 5 do processo: "preciso ter local para criar a copy
 * e anexar no app... e precisa ter no app para mandar para o cliente
 * aprovar também". Antes era um campo de link pro Drive: escrever, revisar
 * e aprovar aconteciam fora, e o app não sabia em que pé estava — nem a
 * tela de projetos, nem o dashboard do cliente.
 */

export type SituacaoCopy =
  /** Existe, ninguém mandou pro cliente ainda. */
  | "rascunho"
  /** Link ligado, esperando o cliente olhar. */
  | "aguardando"
  /** O cliente pediu mudança — volta pra quem escreve. */
  | "ajuste-pedido"
  /** O cliente aprovou. */
  | "aprovada";

export interface EstadoDaCopy {
  shareEnabled: boolean;
  aprovadoEm: string | null;
  ajustePedidoEm: string | null;
}

/**
 * A regra que faz as três colunas virarem um estado só.
 *
 * Aprovação e pedido de ajuste são DATAS, não um status único, pra uma
 * segunda rodada não apagar a primeira. Então quem manda é a mais
 * recente: cliente que aprovou, viu uma correção e pediu outra coisa
 * volta pra "ajuste pedido" sem perder que já tinha aprovado antes.
 */
export function situacaoDaCopy(doc: EstadoDaCopy): SituacaoCopy {
  const aprovado = doc.aprovadoEm ? Date.parse(doc.aprovadoEm) : NaN;
  const ajuste = doc.ajustePedidoEm ? Date.parse(doc.ajustePedidoEm) : NaN;
  const temAprovado = Number.isFinite(aprovado);
  const temAjuste = Number.isFinite(ajuste);

  if (temAprovado && temAjuste) {
    return ajuste > aprovado ? "ajuste-pedido" : "aprovada";
  }
  if (temAprovado) return "aprovada";
  if (temAjuste) return "ajuste-pedido";
  // Sem resposta do cliente: o que diz o estado é se ele já pode ver.
  return doc.shareEnabled ? "aguardando" : "rascunho";
}

export const COPY_LABEL: Record<SituacaoCopy, string> = {
  rascunho: "Rascunho",
  aguardando: "Com o cliente",
  "ajuste-pedido": "Ajuste pedido",
  aprovada: "Aprovada",
};

/** Tons das pílulas. Vermelho não entra: pedido de ajuste é trabalho, não erro. */
export const COPY_TOM: Record<SituacaoCopy, string> = {
  rascunho: "bg-fysi-cream text-fysi-muted border-fysi-line",
  aguardando: "bg-sky-50 text-sky-700 border-sky-200",
  "ajuste-pedido": "bg-amber-50 text-amber-800 border-amber-200",
  aprovada: "bg-fysi-mint/40 text-fysi-deep border-fysi-mint/60",
};

/** O que a tela diz embaixo do título, pra não precisar adivinhar o próximo passo. */
export const COPY_PROXIMO_PASSO: Record<SituacaoCopy, string> = {
  rascunho: "Ligue o link público pra mandar ao cliente.",
  aguardando: "O cliente já consegue ler e responder pelo link.",
  "ajuste-pedido": "O cliente pediu mudança — ajuste e avise.",
  aprovada: "Aprovada pelo cliente. Pode seguir pro design.",
};
