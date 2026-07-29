/**
 * Mensagem de cobrança pronta pra enviar (WhatsApp / copiar).
 * Reúne os dados de pagamento padrão da Fysi (Pix CNPJ + link de cartão Asaas)
 * usados também no cartão de contrato.
 */

/** Chave Pix (CNPJ) padrão da Fysi. */
export const FYSI_PIX_KEY = "53.470.438/0001-08";
/** Link padrão de pagamento parcelado no cartão (Asaas). */
export const FYSI_ASAAS_LINK = "https://www.asaas.com/c/c4pzpl6qzvb61hvg";

function firstName(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

/**
 * Normaliza um telefone BR pro formato aceito pelo wa.me (só dígitos, com DDI
 * 55). Retorna null se não parecer um número válido.
 */
export function normalizeWhatsapp(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  if (!digits.startsWith("55")) digits = "55" + digits;
  // BR = 55 + DDD(2) + número(8 ou 9) → 12 ou 13 dígitos
  if (digits.length < 12 || digits.length > 13) return null;
  return digits;
}

/** Monta a mensagem de cobrança (saudação + valor + dados de pagamento). */
export function buildChargeMessage(opts: {
  nome: string;
  valor: string; // já formatado (ex: "R$ 1.500,00")
  descricao?: string | null;
  pix?: string;
  link?: string;
}): string {
  const nome = firstName(opts.nome);
  const pix = opts.pix || FYSI_PIX_KEY;
  const link = opts.link || FYSI_ASAAS_LINK;
  const oQue = opts.descricao?.trim()
    ? `da cobrança *${opts.descricao.trim()}*`
    : "do seu projeto com a Fysi Lab";
  const lines = [
    `Oi${nome ? ` ${nome}` : ""}! 👋`,
    "",
    `Passando pra lembrar do pagamento ${oQue}.`,
    `Valor em aberto: *${opts.valor}*`,
    "",
    "Segue os dados de pagamento:",
    `• Pix (CNPJ): ${pix}`,
    `• Cartão em até 8x: ${link}`,
    "",
    "Qualquer dúvida é só chamar. Obrigado! 💛",
  ];
  return lines.join("\n");
}

/** Monta o link wa.me com a mensagem já codificada. Null se sem telefone. */
export function waLink(
  whatsapp: string | null | undefined,
  message: string
): string | null {
  const digits = normalizeWhatsapp(whatsapp);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
