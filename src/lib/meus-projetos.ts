import { isClosedTaskStatus, type TaskStatus } from "./project-tasks";

/**
 * O espaço do membro — "precisa ter o espaço de cada membro, poder
 * atualizar o projeto por ali e já ficar atualizado" (Karine, 04/10).
 *
 * Aqui mora só a ordem e a contagem, que é a parte que erra em silêncio:
 * uma lista mal ordenada não dá erro, ela só esconde o que estava
 * atrasado. QUAIS projetos são da pessoa já é resolvido por
 * `projetosDaPessoa` (abas-pessoa.ts), que trata a armadilha do dono do
 * projeto ≠ dono da tarefa.
 */

export interface ProjetoDoMembro {
  id: string;
  nome: string;
  status: TaskStatus;
  responsavel: string | null;
  /** Tarefa de onde a data saiu — vira o title= da linha. */
  tarefa: string | null;
  dataInicial: string | null;
  dataVencimento: string | null;
  /** Ata mais recente do projeto, se existir. */
  ataId: string | null;
  /** Quantas atas ativas o projeto tem. */
  atas: number;
}

/**
 * Atrasado primeiro, depois o que vence antes, depois o sem data — e o
 * projeto FINALIZADO sempre por último, qualquer que seja a data dele.
 *
 * O finalizado no fim e não fora da lista: ele continua sendo trabalho da
 * pessoa (o cliente pode voltar, a cobrança pode estar aberta), mas não é
 * o que ela precisa olhar hoje. Tirá-lo daqui faria a pessoa achar que o
 * projeto sumiu.
 *
 * Não reordena o array recebido.
 */
export function ordenarProjetosDoMembro(
  projetos: ProjetoDoMembro[],
  hoje: string
): ProjetoDoMembro[] {
  const peso = (p: ProjetoDoMembro): number => {
    if (isClosedTaskStatus(p.status)) return 3;
    if (!p.dataVencimento) return 2;
    return p.dataVencimento < hoje ? 0 : 1;
  };

  return [...projetos].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;
    // Dentro do mesmo peso: quem vence antes vem antes. Sem data, nome —
    // é o único critério estável que existe ali.
    if (a.dataVencimento && b.dataVencimento && a.dataVencimento !== b.dataVencimento) {
      return a.dataVencimento.localeCompare(b.dataVencimento);
    }
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export interface ResumoDosProjetos {
  total: number;
  /** Em aberto com vencimento antes de hoje. */
  atrasados: number;
  /** Em aberto vencendo hoje. */
  vencemHoje: number;
  /** Status do grupo "fechado". */
  finalizados: number;
}

/**
 * Os números do cabeçalho do espaço do membro.
 *
 * `atrasados` e `vencemHoje` ignoram projeto finalizado de propósito: um
 * projeto entregue em março com data de vencimento vencida não é atraso,
 * é história. Foi o mesmo erro que `isClientStuck` já tinha cometido uma
 * vez (projeto entregue contado como "parado").
 */
export function resumoDosProjetos(
  projetos: ProjetoDoMembro[],
  hoje: string
): ResumoDosProjetos {
  let atrasados = 0;
  let vencemHoje = 0;
  let finalizados = 0;
  for (const p of projetos) {
    if (isClosedTaskStatus(p.status)) {
      finalizados++;
      continue;
    }
    if (!p.dataVencimento) continue;
    if (p.dataVencimento < hoje) atrasados++;
    else if (p.dataVencimento === hoje) vencemHoje++;
  }
  return { total: projetos.length, atrasados, vencemHoje, finalizados };
}
