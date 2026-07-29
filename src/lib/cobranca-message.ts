/**
 * Mensagem de cobrança pronta pra enviar (WhatsApp / copiar).
 * Reúne os dados de pagamento padrão da Fysi (Pix CNPJ + link de cartão Asaas)
 * usados também no cartão de contrato.
 */

/** Chave Pix (CNPJ) padrão da Fysi. */
export const FYSI_PIX_KEY = "53.470.438/0001-08";
/** Chave Pix (e-mail) da Fysi. */
export const FYSI_PIX_EMAIL = "contato@fysilabdigital.com.br";

/** Chaves Pix disponíveis pra alternar na hora de cobrar. */
export interface PixKey {
  id: string;
  label: string;
  value: string;
}

export const PIX_KEYS: PixKey[] = [
  { id: "cnpj", label: "CNPJ", value: FYSI_PIX_KEY },
  { id: "email", label: "E-mail", value: FYSI_PIX_EMAIL },
];

/** Link padrão de pagamento parcelado no cartão (Asaas). */
export const FYSI_ASAAS_LINK = "https://www.asaas.com/c/c4pzpl6qzvb61hvg";

/**
 * Catálogo de links de pagamento (Asaas) salvos — normalmente um por
 * pacote/valor. Serve pra escolher o link certo na hora de cobrar ou de
 * montar o contrato, sem precisar colar a URL toda vez.
 */
export interface PaymentLink {
  id: string;
  label: string;
  valor: number;
  url: string;
}

export const PAYMENT_LINKS: PaymentLink[] = [
  {
    id: "l1997",
    label: "R$ 1.997 — parcelado",
    valor: 1997,
    url: "https://www.asaas.com/c/nabdcnbx9cv3b9le",
  },
  {
    id: "l1800",
    label: "R$ 1.800 — 6x no cartão",
    valor: 1800,
    url: "https://www.asaas.com/c/6o0z07fwwg4hzpvv",
  },
  {
    id: "l2300",
    label: "R$ 2.300",
    valor: 2300,
    url: "https://www.asaas.com/c/1qs7h6q2u16jcph1",
  },
  {
    id: "l1600",
    label: "R$ 1.600",
    valor: 1600,
    url: "https://www.asaas.com/c/fp59l88ygq16opth",
  },
  {
    id: "l1497",
    label: "R$ 1.497",
    valor: 1497,
    url: "https://www.asaas.com/c/ozyxk99adltdm2z8",
  },
];

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
  const pixTipo = pix.includes("@") ? "e-mail" : "CNPJ";
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
    `• Pix (${pixTipo}): ${pix}`,
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
