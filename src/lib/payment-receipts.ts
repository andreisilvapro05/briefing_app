/** Formas de pagamento que a agência recebe na prática. */
export const FORMAS_PAGAMENTO = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outro", label: "Outro" },
] as const;

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]["value"];

export const FORMA_LABEL: Record<string, string> = Object.fromEntries(
  FORMAS_PAGAMENTO.map((f) => [f.value, f.label])
);

export interface PaymentReceipt {
  id: string;
  client_id: string;
  valor: number;
  pago_em: string;
  forma: string;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
}

export function somaRecebida(recibos: PaymentReceipt[]): number {
  return recibos.reduce((s, r) => s + Number(r.valor || 0), 0);
}

/** "1.234,56" / "1234.56" / "R$ 1.234,56" → 1234.56 */
export function parseValorBR(bruto: string): number {
  const limpo = bruto
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}
