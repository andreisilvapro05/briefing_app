import { TASK_STATUS_GROUP, type TaskStatus } from "./project-tasks";

/**
 * A tarefa conta como TRABALHO A FAZER?
 *
 * Karine (04/10), vendo a Marplast no Meu Trabalho: "ali não deve
 * aparecer".
 *
 * A Marplast está com status `completo-entregue` e tem 11 das 13 tarefas
 * ainda abertas. Ela não é exceção: em 04/10 eram **24 projetos entregues
 * ou concluídos somando 158 tarefas abertas**, e só UMA delas tinha prazo.
 * São as etapas que o checklist cria junto com o projeto e ninguém fecha
 * uma a uma quando a entrega acontece — o projeto é marcado como entregue
 * e pronto.
 *
 * O efeito: o trabalho de todo mundo vinha cheio de etapa de projeto que
 * já acabou, e a conta de "tarefas pendentes da equipe" era ficção.
 *
 * ⚠️ ISTO NÃO APAGA NADA. A tarefa continua existindo, continua visível na
 * aba Tarefas do próprio cliente, e o painel "Projetos incompletos" segue
 * apontando a contradição ("marcado como entregue, mas com tarefa aberta")
 * pra ela ser resolvida de verdade. O que muda é só parar de competir por
 * atenção nas telas de quem executa.
 */

export interface TarefaComProjeto {
  /** Status da própria tarefa. */
  status: TaskStatus;
  /** `null` = demanda interna da agência, que não tem projeto. */
  client: { status?: string | null; arquivado_em?: string | null } | null;
}

/**
 * O PROJETO está fechado? (entregue, concluído, cancelado.)
 *
 * Demanda interna não tem projeto — e nunca é descartada por esta regra.
 */
export function projetoFechado(tarefa: TarefaComProjeto): boolean {
  if (!tarefa.client) return false;
  /**
   * ARQUIVADO conta como fechado aqui.
   *
   * Arquivar é "este projeto não vai acontecer" (desistência). A Lista, o
   * Quadro e os Relatórios já descartavam, mas as TAREFAS seguiam no
   * trabalho de todo mundo — a Balen Susin está arquivada com 11 tarefas
   * abertas, e o status dela é "parado", que não é um status fechado.
   */
  if (tarefa.client.arquivado_em) return true;
  const status = tarefa.client.status;
  if (!status) return false;
  return TASK_STATUS_GROUP[status as TaskStatus] === "fechado";
}

/**
 * Entra nas telas de trabalho (Meu Trabalho, Tarefas, Visão Geral, Equipe)?
 *
 * Tarefa aberta de projeto fechado fica de fora. Tarefa JÁ FECHADA segue
 * passando: quem filtra concluída é cada tela, e misturar as duas regras
 * aqui esconderia o histórico de quem quer ver o que terminou.
 */
export function ehTrabalhoAtivo(tarefa: TarefaComProjeto): boolean {
  if (TASK_STATUS_GROUP[tarefa.status] === "fechado") return true;
  return !projetoFechado(tarefa);
}

/** Aplica a regra numa lista — o uso real nas telas. */
export function soTrabalhoAtivo<T extends TarefaComProjeto>(tarefas: T[]): T[] {
  return tarefas.filter(ehTrabalhoAtivo);
}
