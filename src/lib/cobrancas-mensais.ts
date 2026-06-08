/**
 * Cobranças mensais — clientes recorrentes (SEO, manutenção, hosting).
 *
 * Separado de pagamentos one-off do contrato. Pode ou não estar ligado
 * a um client_id do briefing_app.
 */

export interface PagamentoHistorico {
  id: string;
  /** Mês de referência da cobrança no formato "YYYY-MM" (ex: "2026-06"). */
  mesReferencia: string;
  valorPago: number;
  /** ISO date — quando foi pago. */
  pagoEm: string;
  /** "pix" | "cartao" | "boleto" | "outro" — string livre pra facilitar. */
  forma: string;
  observacao: string;
}

export type TipoCobranca = "mensal" | "pontual";

export interface CobrancaMensal {
  id: string;
  client_id: string | null;
  nome: string;
  empresa: string | null;
  whatsapp: string | null;
  email: string | null;
  valor_mensal: number;
  dia_cobranca: number;
  descricao: string | null;
  ativa: boolean;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string | null;
  historico: PagamentoHistorico[];
  /** 'mensal' = recorrente; 'pontual' = uma vez só (usa data_vencimento). */
  tipo: TipoCobranca;
  /** Pra pontuais. Mensais usam dia_cobranca + mês corrente. */
  data_vencimento: string | null;
  created_at: string;
  updated_at: string;
}

export interface CobrancaMensalForm {
  client_id?: string | null;
  nome: string;
  empresa?: string;
  whatsapp?: string;
  email?: string;
  valor_mensal: number;
  dia_cobranca: number;
  descricao?: string;
  ativa?: boolean;
  data_inicio?: string;
  data_fim?: string | null;
}

/**
 * Formato de mês de referência usado nas cobranças (YYYY-MM).
 */
export function mesRef(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Lista os últimos N meses (incluindo o atual) no formato YYYY-MM.
 */
export function ultimosMeses(qtd: number, refDate: Date = new Date()): string[] {
  const arr: string[] = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    arr.push(mesRef(d));
  }
  return arr;
}

/**
 * Cobrança está em dia neste mês? (suporta mensal e pontual)
 *  - Mensal: tem registro do mês atual? Senão, passou do dia_cobranca?
 *  - Pontual: tem QUALQUER pagamento? Senão, passou da data_vencimento?
 */
export function statusDoMes(
  c: CobrancaMensal,
  refDate: Date = new Date()
): "pago" | "a_cobrar" | "atrasado" {
  if (!c.ativa) return "pago";

  if (c.tipo === "pontual") {
    if (c.historico.length > 0) return "pago";
    if (!c.data_vencimento) return "a_cobrar";
    const venc = new Date(c.data_vencimento);
    return refDate > venc ? "atrasado" : "a_cobrar";
  }

  // Mensal — padrão
  const ref = mesRef(refDate);
  const pago = c.historico.some((h) => h.mesReferencia === ref);
  if (pago) return "pago";
  const hoje = refDate.getDate();
  return hoje < c.dia_cobranca ? "a_cobrar" : "atrasado";
}

/**
 * MRR (Monthly Recurring Revenue) — soma das cobranças MENSAIS ativas.
 * Pontuais NÃO entram no MRR (são one-off).
 */
export function calcMRR(cobrancas: CobrancaMensal[]): number {
  return cobrancas
    .filter((c) => c.ativa && c.tipo === "mensal")
    .reduce((sum, c) => sum + Number(c.valor_mensal), 0);
}

/**
 * Stats de receita mensal recorrente — pra dashboard.
 */
export interface CobrancasStats {
  total: number;
  ativas: number;
  mrr: number;
  recebidoEsteMes: number;
  aReceberEsteMes: number;
  atrasados: CobrancaMensal[];
  aCobrar: CobrancaMensal[];
  pagos: CobrancaMensal[];
}

export function statsCobrancas(
  cobrancas: CobrancaMensal[],
  refDate: Date = new Date()
): CobrancasStats {
  const ativas = cobrancas.filter((c) => c.ativa);
  const mrr = calcMRR(ativas);
  const ref = mesRef(refDate);

  let recebidoEsteMes = 0;
  let aReceberEsteMes = 0;
  const atrasados: CobrancaMensal[] = [];
  const aCobrar: CobrancaMensal[] = [];
  const pagos: CobrancaMensal[] = [];

  ativas.forEach((c) => {
    const status = statusDoMes(c, refDate);
    if (status === "pago") {
      // Mensal: pega o registro do mês. Pontual: soma todo histórico.
      if (c.tipo === "mensal") {
        const reg = c.historico.find((h) => h.mesReferencia === ref);
        if (reg) recebidoEsteMes += Number(reg.valorPago);
      } else {
        c.historico.forEach((h) => {
          const d = new Date(h.pagoEm);
          if (mesRef(d) === ref) recebidoEsteMes += Number(h.valorPago);
        });
      }
      pagos.push(c);
    } else {
      aReceberEsteMes += Number(c.valor_mensal);
      if (status === "atrasado") atrasados.push(c);
      else aCobrar.push(c);
    }
  });

  return {
    total: cobrancas.length,
    ativas: ativas.length,
    mrr,
    recebidoEsteMes,
    aReceberEsteMes,
    atrasados,
    aCobrar,
    pagos,
  };
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Próxima data de cobrança a partir de hoje.
 */
export function proximaCobranca(
  diaCobranca: number,
  refDate: Date = new Date()
): Date {
  const ano = refDate.getFullYear();
  const mes = refDate.getMonth();
  const hoje = refDate.getDate();
  if (hoje < diaCobranca) {
    return new Date(ano, mes, Math.min(diaCobranca, diasNoMes(ano, mes)));
  }
  // Próximo mês
  const proxAno = mes === 11 ? ano + 1 : ano;
  const proxMes = mes === 11 ? 0 : mes + 1;
  return new Date(
    proxAno,
    proxMes,
    Math.min(diaCobranca, diasNoMes(proxAno, proxMes))
  );
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}
