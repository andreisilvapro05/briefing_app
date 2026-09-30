/**
 * Teto de upload do app inteiro.
 *
 * Todo upload daqui passa por Server Action, e a Vercel corta o corpo da
 * requisição em ~4,5 MB — `next.config.ts` fixa `bodySizeLimit: "4mb"`.
 *
 * O teto do app fica ABAIXO desse limite de propósito. Igualar os dois
 * (era o que estava) cria uma faixa cega: um arquivo de 4,2 MB passa na
 * nossa validação mas morre no transporte, antes de a Server Action
 * rodar — a tela volta sem salvar e sem dizer por quê. Com folga, quem é
 * recusado é recusado POR NÓS, com mensagem.
 *
 * Arquivo maior que isto não é caso de aumentar o número: é caso de link.
 */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "3 MB";

export function acimaDoLimite(bytes: number): boolean {
  return bytes > MAX_UPLOAD_BYTES;
}

/**
 * Quanto `clients.pagamento_pago` passa a valer depois de mexer nos
 * comprovantes.
 *
 * O total do cliente tem duas parcelas: o que a equipe lançou À MÃO antes
 * desta tela existir (sem comprovante) e a soma dos comprovantes. Só a
 * segunda muda quando se adiciona ou apaga um recibo.
 *
 * A versão anterior era `Math.max(pagoAtual, somaDosRecibos)`. Ela
 * protegia o lançamento manual de sumir, mas nunca DESCIA: apagar um
 * comprovante lançado errado deixava o valor inflado pra sempre, e a
 * ficha do cliente dizia que ele tinha pago mais do que pagou.
 *
 * @param pagoAtual   o que está gravado no cliente agora
 * @param somaAntes   soma dos comprovantes ANTES da mudança
 * @param somaDepois  soma dos comprovantes DEPOIS da mudança
 */
export function novoPagamentoPago(
  pagoAtual: number,
  somaAntes: number,
  somaDepois: number
): number {
  // O que não veio de comprovante. Nunca negativo: se o gravado for menor
  // que a soma (dessincronizado), a parcela manual é zero, não dívida.
  const manual = Math.max(0, pagoAtual - somaAntes);
  return arredondar(manual + somaDepois);
}

/** Centavos — dinheiro em float acumula sujeira (0.1 + 0.2). */
function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}
