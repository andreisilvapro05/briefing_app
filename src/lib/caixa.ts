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
 * Duas datas, dois sentidos (migration 20260927140000):
 *   `pago_em`     — quando o CLIENTE pagou
 *   `recebido_em` — quando CAIU NA CONTA (nulo = no mesmo dia)
 *
 * O caixa usa a segunda, com a primeira de reserva. É o que resolve "no
 * Asaas começamos a receber só no outro mês quando é cartão, não
 * antecipamos": a compra de setembro que cai em outubro sai do caixa de
 * setembro e entra no de outubro, sem sumir do mapa — vira `aReceber`.
 */

export interface Recebimento {
  valor: number | string | null;
  pago_em: string | null;
  /** Quando caiu na conta. Ausente/nulo = no mesmo dia de `pago_em`. */
  recebido_em?: string | null;
  forma: string | null;
}

export interface FormaNoMes {
  forma: string;
  rotulo: string;
  quantidade: number;
  total: number;
}

export interface CaixaDoMes {
  mes: string;
  /** Soma do que CAIU NA CONTA no mês (recebido_em, ou pago_em na falta). */
  entrou: number;
  /** Quantos recebimentos. */
  quantidade: number;
  /** Quebra por forma, da maior pra menor. */
  porForma: FormaNoMes[];
  /** Custos lançados na competência do mês (hoje sempre 0 — tabela vazia). */
  saiu: number;
  /** entrou - saiu. */
  sobrou: number;
  /**
   * Pago pelo cliente neste mês e com queda marcada pra um mês seguinte —
   * tipicamente cartão. Não entra em `entrou`: ainda não é caixa.
   */
  aReceber: number;
  quantidadeAReceber: number;
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

/** A data que vale pro caixa: quando caiu, ou quando pagou na falta dela. */
export function dataDeCaixa(r: {
  pago_em: string | null;
  recebido_em?: string | null;
}): string | null {
  return r.recebido_em ?? r.pago_em;
}

export function montarCaixaDoMes(
  recebimentos: Recebimento[],
  custos: { valor: number | string | null; competencia: string | null }[],
  mes: string
): CaixaDoMes {
  const doMes = recebimentos.filter((r) => competenciaDe(dataDeCaixa(r)) === mes);

  // Pago neste mês e com queda marcada pra depois: é venda, não é caixa.
  let aReceber = 0;
  let quantidadeAReceber = 0;
  for (const r of recebimentos) {
    if (competenciaDe(r.pago_em) !== mes) continue;
    const queda = competenciaDe(r.recebido_em ?? null);
    if (queda && queda > mes) {
      aReceber += Number(r.valor) || 0;
      quantidadeAReceber += 1;
    }
  }

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
    aReceber,
    quantidadeAReceber,
  };
}

/** Os meses que têm movimento, do mais novo pro mais antigo. */
export function mesesComEntrada(
  recebimentos: { pago_em: string | null; recebido_em?: string | null }[]
): string[] {
  const s = new Set<string>();
  for (const r of recebimentos) {
    // Os dois lados entram: um mês pode ter só venda de cartão que cai
    // depois, e outro só a queda dessa venda.
    for (const d of [dataDeCaixa(r), r.pago_em]) {
      const m = competenciaDe(d);
      if (m) s.add(m);
    }
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


/**
 * As mensalidades recebidas, no formato do caixa.
 *
 * O caixa do mês lia só `payment_receipts` — o pagamento do PROJETO. A
 * receita recorrente (SEO, manutenção, hosting) vivia noutra tabela e
 * ficava fora da conta: o mês fechava faltando tudo que entra todo mês,
 * justamente o que é mais previsível. Karine (26/09): "precisamos
 * contabilizar e cruzar o caixa completo".
 *
 * `pagoEm` é a data do registro; mensalidade não tem o caso do cartão que
 * cai depois, então `recebido_em` fica nulo e o caixa usa `pago_em`.
 */
export function recebimentosDeCobrancas(
  cobrancas: { historico?: PagamentoDeCobranca[] | null }[]
): Recebimento[] {
  const out: Recebimento[] = [];
  for (const c of cobrancas) {
    for (const h of c.historico ?? []) {
      if (!h?.pagoEm) continue;
      out.push({
        valor: h.valorPago ?? 0,
        // ISO completo ("2026-09-23T12:00:00Z") ou só a data — o caixa
        // compara pelo prefixo YYYY-MM, então corta aqui.
        pago_em: String(h.pagoEm).slice(0, 10),
        recebido_em: null,
        forma: h.forma ?? null,
      });
    }
  }
  return out;
}

interface PagamentoDeCobranca {
  valorPago: number;
  pagoEm: string;
  forma: string | null;
}
