import { isClosedTaskStatus, type TaskStatus } from "./project-tasks";

/**
 * Os campos que o ClickUp mostra na LINHA DO PROJETO — "Lista Andrei",
 * "Lista Valéria" (print da Karine, 26/09): Nome, Responsável, Data
 * inicial, Data de vencimento, Prioridade, agrupados por status.
 *
 * No ClickUp cada cliente é uma tarefa-mãe com subtarefas, então ela tem
 * responsável e data próprios. Aqui o cliente não tem: quem tem é a tarefa.
 * Então a linha mostra a tarefa que MANDA no projeto agora — a aberta que
 * vence primeiro. É a que define quando o projeto anda e quem está com ele.
 */

export interface LinhaDoProjeto {
  responsavel: string | null;
  dataInicial: string | null;
  dataVencimento: string | null;
  prioridade: string | null;
  /** Título da tarefa de onde os campos saíram — vira o title= da linha. */
  tarefa: string | null;
}

const VAZIA: LinhaDoProjeto = {
  responsavel: null,
  dataInicial: null,
  dataVencimento: null,
  prioridade: null,
  tarefa: null,
};

type TarefaDaLinha = {
  titulo: string;
  status: string;
  responsavel: string | null;
  prioridade: string | null;
  data_inicial: string | null;
  data_vencimento: string | null;
};

/**
 * @param pessoa quando dado, só as tarefas dessa pessoa contam — é o que
 * faz a "Lista Andrei" mostrar a data DELE no projeto, não a de outro.
 */
export function linhaDoProjeto(
  tarefas: TarefaDaLinha[],
  pessoa?: string | null
): LinhaDoProjeto {
  const abertas = tarefas.filter(
    (t) =>
      !isClosedTaskStatus(t.status as TaskStatus) &&
      (!pessoa || t.responsavel === pessoa)
  );
  if (abertas.length === 0) return VAZIA;

  // A que vence primeiro manda. Sem data vai pro fim: tarefa não agendada
  // não define o andamento do projeto, mas ainda serve de última opção
  // quando é tudo que existe.
  const ordenadas = [...abertas].sort((a, b) => {
    const av = a.data_vencimento;
    const bv = b.data_vencimento;
    if (av && bv) return av < bv ? -1 : av > bv ? 1 : 0;
    if (av) return -1;
    if (bv) return 1;
    return 0;
  });
  const t = ordenadas[0];
  return {
    responsavel: t.responsavel,
    dataInicial: t.data_inicial,
    dataVencimento: t.data_vencimento,
    prioridade: t.prioridade,
    tarefa: t.titulo,
  };
}
