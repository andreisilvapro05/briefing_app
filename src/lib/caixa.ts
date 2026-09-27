/**
 * Caixa do mês — quanto ENTROU de fato, separado por forma de pagamento.
 *
 * Pedido da Karine (26/09): "precisamos ter clareza todos os meses do que é
 * pagamento em pix e o que é fechamento; essas informações são difusas".
 *
 * O dado já existia inteiro em `payment_receipts` (36 recebimentos, forma
 * preenchida em todos) e não aparecia em nenhuma tela: `pago_em` era lido
 * num lugar só, a ficha do cliente. O que a tela de Relatórios chamava de
 * "Receita" é outra conta — a soma de `clients.pagamento_pago`, números
 * digitados à mão, que não sabem em que mês o dinheiro entrou.
 *
 * ATENÇÃO ao que este cálculo ainda NÃO resolve: `pago_em` carrega dois
 * sentidos ao mesmo tempo — quando o cliente pagou e quando a agência
 * recebeu. No cartão os dois não coincidem ("no Asaas começamos a receber
 * só no outro mês quando é cartão, não antecipamos"), e parcela não existe
 * como registro. Então a coluna "cartão" aqui é quanto foi COMPRADO no
 * mês, não quanto caiu na conta. Separar os dois pede coluna nova.
 */

export interface FormaNoMes {
  forma: string;
  rotulo: string;
  quantidade: number;
  total: number;
}

export interface CaixaDoMes {
  mes: string;
  /** Soma de tudo que entrou no mês. */
  entrou: number;
  /** Quantos recebimentos. */
  quantidade: number;
  /** Quebra por forma, da maior pra menor. */
  porForma: FormaNoMes[];
  /** Custos lançados na competência do mês (hoje sempre 0 — tabela vazia). */
  saiu: number;
  /** entrou - saiu. */
  sobrou: number;
}

/** Rótulos das formas conhecidas. Forma nova aparece com o valor cru. */
const ROTULOS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

export function rotuloDaForma(forma: string | null): string {
  const f = (forma ?? "").trim();
  if (!f) return "Não informada";
  return ROTULOS[f] ?? f;
}

/** "2026-09" a partir de uma data ISO. Null quando a data não presta. */
export function competenciaDe(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso.trim());
  return m ? `${m[1]}-${m[2]}` : null;
}

export function montarCaixaDoMes(
  recebimentos: { valor: number | string | null; pago_em: string | null; forma: string | null }[],
  custos: { valor: number | string | null; competencia: string | null }[],
  mes: string
): CaixaDoMes {
  const doMes = recebimentos.filter((r) => competenciaDe(r.pago_em) === mes);

  const porFormaMap = new Map<string, { quantidade: number; total: number }>();
  let entrou = 0;
  for (const r of doMes) {
    const v = Number(r.valor) || 0;
    entrou += v;
    const k = (r.forma ?? "").trim() || "__sem__";
    const atual = porFormaMap.get(k) ?? { quantidade: 0, total: 0 };
    atual.quantidade += 1;
    atual.total += v;
    porFormaMap.set(k, atual);
  }

  const porForma: FormaNoMes[] = [...porFormaMap.entries()]
    .map(([forma, v]) => ({
      forma,
      rotulo: rotuloDaForma(forma === "__sem__" ? null : forma),
      quantidade: v.quantidade,
      total: v.total,
    }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const saiu = custos
    .filter((c) => (c.competencia ?? "").trim() === mes)
    .reduce((s, c) => s + (Number(c.valor) || 0), 0);

  return {
    mes,
    entrou,
    quantidade: doMes.length,
    porForma,
    saiu,
    sobrou: entrou - saiu,
  };
}

/** Os meses que têm recebimento, do mais novo pro mais antigo. */
export function mesesComEntrada(
  recebimentos: { pago_em: string | null }[]
): string[] {
  const s = new Set<string>();
  for (const r of recebimentos) {
    const m = competenciaDe(r.pago_em);
    if (m) s.add(m);
  }
  return [...s].sort().reverse();
}

const NOMES_DE_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-09" → "setembro de 2026". Valor estranho volta como veio. */
export function rotuloDoMes(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  const i = Number(m[2]) - 1;
  if (i < 0 || i > 11) return mes;
  return `${NOMES_DE_MES[i]} de ${m[1]}`;
}
