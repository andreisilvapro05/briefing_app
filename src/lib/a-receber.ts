import { statusDoMes, type CobrancaMensal } from "./cobrancas-mensais";

/**
 * Tudo o que a agência tem pra receber, numa lista só.
 *
 * Karine (2026-09-30): "quem cliente recorrente ficar junto no aviso
 * também pagamento pendente". Antes eram duas listas em lugares
 * diferentes da mesma tela — o saldo em aberto do projeto num aviso no
 * topo, e a mensalidade atrasada num cartão lá embaixo. Pra responder
 * "quem me deve hoje" era preciso somar as duas de cabeça.
 *
 * Os cartões de cobrança recorrente continuam existindo: é neles que se
 * registra o pagamento e se edita a cobrança. Aqui é só o aviso.
 */

export type OrigemAReceber = "projeto" | "recorrente";

export interface LinhaAReceber {
  /** Único na lista — `origem` + id, porque projeto e cobrança têm ids próprios. */
  chave: string;
  id: string;
  origem: OrigemAReceber;
  nome: string;
  /** Observação do pagamento, ou a descrição da cobrança. */
  detalhe: string | null;
  whatsapp: string | null;
  /** Valor total combinado. Null quando não se aplica (mensalidade). */
  total: number | null;
  pago: number | null;
  falta: number;
  /** Passou do prazo: dia da cobrança no mês, ou vencimento do pontual. */
  atrasado: boolean;
}

export interface ProjetoPendente {
  id: string;
  nome: string;
  empresa: string | null;
  whatsapp: string | null;
  pagamento_total: number | null;
  pagamento_pago: number | null;
  pagamento_observacao: string | null;
}

/**
 * Junta os saldos de projeto com as cobranças recorrentes em aberto.
 *
 * Ordem: atrasado primeiro — é o que precisa de ação hoje —, e dentro de
 * cada bloco o maior valor na frente.
 */
export function montarAReceber(
  projetos: ProjetoPendente[],
  cobrancas: CobrancaMensal[],
  agora: Date = new Date()
): { linhas: LinhaAReceber[]; total: number; atrasados: number } {
  const linhas: LinhaAReceber[] = [];

  for (const p of projetos) {
    const total = Number(p.pagamento_total) || 0;
    const pago = Number(p.pagamento_pago) || 0;
    const falta = Math.max(0, total - pago);
    // Centavo de arredondamento não é dívida.
    if (falta <= 0.01) continue;
    linhas.push({
      chave: `projeto:${p.id}`,
      id: p.id,
      origem: "projeto",
      nome: p.empresa?.trim() || p.nome,
      detalhe: p.pagamento_observacao?.trim() || null,
      whatsapp: p.whatsapp,
      total,
      pago,
      falta,
      /**
       * Saldo de projeto não tem data de vencimento no sistema — marcar
       * como atrasado seria inventar um prazo que ninguém combinou.
       */
      atrasado: false,
    });
  }

  for (const c of cobrancas) {
    if (!c.ativa) continue;
    const status = statusDoMes(c, agora);
    if (status === "pago") continue;
    linhas.push({
      chave: `recorrente:${c.id}`,
      id: c.id,
      origem: "recorrente",
      nome: c.empresa?.trim() || c.nome,
      detalhe: c.descricao?.trim() || null,
      whatsapp: c.whatsapp,
      total: null,
      pago: null,
      falta: Number(c.valor_mensal) || 0,
      atrasado: status === "atrasado",
    });
  }

  linhas.sort((a, b) => {
    if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
    return b.falta - a.falta;
  });

  return {
    linhas,
    total: linhas.reduce((s, l) => s + l.falta, 0),
    atrasados: linhas.filter((l) => l.atrasado).length,
  };
}
