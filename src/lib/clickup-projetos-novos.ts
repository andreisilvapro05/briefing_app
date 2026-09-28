/**
 * Decide o que fazer com uma tarefa de PROJETO do ClickUp que nenhum
 * cliente do app aponta.
 *
 * O buraco que isso fecha: o sync criava TAREFAS, nunca PROJETOS. Projeto
 * que só existia lá nunca aparecia aqui — na comparação de 28/09 eram
 * quatro (Marplast, Tatiana Garcia, Karine Serigy e Javier Lopes), e a
 * lista do app ficava sempre com menos gente que a do ClickUp.
 *
 * Regra de ouro, a mesma de `briefing-match.ts`: ERRAR O VÍNCULO É PIOR QUE
 * NÃO VINCULAR. Um projeto pendurado no cliente errado leva junto o
 * pagamento, o contrato e o briefing de outra pessoa. Na dúvida, esta
 * função devolve "ambíguo" e ninguém é tocado.
 */

/**
 * minúsculas, sem acento, SEM espaço e sem pontuação.
 *
 * Sem espaço de propósito: no ClickUp o projeto é "Babi" e aqui a empresa
 * é "Babi Taróloga"; com espaços, "babi" não estaria contido em
 * "babi tarologa" por prefixo de palavra sem regra extra.
 */
export function normalizarNomeDeProjeto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface CandidatoProjeto {
  id: string;
  /** Todos os nomes pelos quais esse cliente pode ser conhecido. */
  nomes: (string | null | undefined)[];
  /** Já aponta pra alguma tarefa do ClickUp? */
  clickupTaskId?: string | null;
  arquivado?: boolean;
}

export type Casamento =
  /** Achou um cliente sem vínculo: é só gravar o clickup_task_id nele. */
  | { tipo: "vincular"; clientId: string; motivo: string }
  /** Não existe aqui: pode criar. */
  | { tipo: "criar" }
  /**
   * Achou, mas não dá pra mexer: ou o cliente foi arquivado de propósito,
   * ou já aponta pra outra tarefa, ou mais de um cliente casou.
   */
  | { tipo: "pular"; motivo: string; clientId?: string };

/** Nome curto demais casa com qualquer coisa ("sa", "lp"). */
const MINIMO_PARA_CONTER = 4;

export function casarProjeto(
  nomeClickUp: string,
  candidatos: CandidatoProjeto[]
): Casamento {
  const alvo = normalizarNomeDeProjeto(nomeClickUp);
  if (alvo.length < 2) return { tipo: "pular", motivo: "nome vazio no ClickUp" };

  const chavesDe = (c: CandidatoProjeto) =>
    c.nomes
      .map((n) => normalizarNomeDeProjeto(n ?? ""))
      .filter((k) => k.length > 0);

  const exatos = candidatos.filter((c) => chavesDe(c).some((k) => k === alvo));
  if (exatos.length > 0) return decidir(exatos, "nome igual");

  // "Serigy" (aqui) dentro de "Karine Serigy" (lá); "Babi" (lá) dentro de
  // "Babi Taróloga" (aqui). Só vale quando UM cliente casa — dois casando
  // significa que o nome é genérico demais pra confiar.
  const contidos = candidatos.filter((c) =>
    chavesDe(c).some(
      (k) =>
        k.length >= MINIMO_PARA_CONTER &&
        (alvo.includes(k) || (alvo.length >= MINIMO_PARA_CONTER && k.includes(alvo)))
    )
  );
  if (contidos.length > 0) return decidir(contidos, "um nome contém o outro");

  return { tipo: "criar" };
}

function decidir(achados: CandidatoProjeto[], motivo: string): Casamento {
  if (achados.length > 1) {
    return {
      tipo: "pular",
      motivo: `${achados.length} clientes com o mesmo nome — vincule na mão`,
    };
  }
  const c = achados[0];
  if (c.arquivado) {
    return { tipo: "pular", motivo: "cliente arquivado de propósito", clientId: c.id };
  }
  if (c.clickupTaskId) {
    return {
      tipo: "pular",
      motivo: "cliente já aponta pra outra tarefa do ClickUp",
      clientId: c.id,
    };
  }
  return { tipo: "vincular", clientId: c.id, motivo };
}

/**
 * Só projeto EM ANDAMENTO nasce sozinho aqui.
 *
 * A pasta do ClickUp guarda o histórico inteiro da agência: das ~100
 * tarefas, a grande maioria está em "concluído"/"completo| entregue", e
 * junto vêm coisas que não são projeto de cliente ("Banner Rafael Rapozo",
 * "OTIMIZAÇÃO DA PÁGINA DA FYSI"). Criar tudo encheria a lista de gente
 * que a Fysi não atende mais.
 */
export const STATUS_QUE_CRIAM_PROJETO = new Set([
  "parado",
  "nem-comecou-nada",
  "a-iniciar",
  "onboarding",
  "envio-informacoes",
  "redacao-copy",
  "design-pagina",
  "validacao-design-copy",
  "ajustes-design-copy",
  "implementacao",
  "validacao-implementacao",
  "ajuste-implementacao",
  "otimizacao-entrega",
]);

/**
 * "recorrente" mapeia pra "a-iniciar", mas é manutenção mensal da lista
 * "Recorrente" — não é projeto novo. Sem esta exceção, Rogério, Gerlan e
 * companhia entrariam como se fossem landing pages a fazer.
 */
const BRUTOS_QUE_NAO_CRIAM = new Set(["recorrente", "pendência", "pendencia"]);

export function statusPermiteCriar(statusApp: string, statusBruto: string): boolean {
  if (BRUTOS_QUE_NAO_CRIAM.has(statusBruto.toLowerCase().trim())) return false;
  return STATUS_QUE_CRIAM_PROJETO.has(statusApp);
}
