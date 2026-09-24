import { TASK_STATUS_GROUP, isClosedTaskStatus, type TaskStatus } from "./project-tasks";
import { statusLaneId } from "./workflow-lanes";

/**
 * "Projetos a vencer" — o que tem data chegando, na ordem em que aperta.
 *
 * Pedido da Karine (24/09), apontando pra uma tela com ETAPA / PROGRESSO /
 * STATUS: "ter a parte de projetos a vencer".
 *
 * A diferença pra tela de Tarefas é a unidade. Tarefa pendente é uma lista
 * de linhas soltas; aqui a linha é o PROJETO, e o prazo dele é o da tarefa
 * aberta que vence primeiro. É a pergunta "que cliente está prestes a
 * estourar", que nenhuma outra tela respondia.
 *
 * Projeto sem nenhuma tarefa com data não aparece: não há o que vencer.
 * Isso é muito projeto — as etapas futuras do checklist nascem sem data —
 * e por isso o contador de fora dos cortes existe (`semData`).
 */

export type Situacao = "atrasado" | "atencao" | "no-prazo";

export interface ProjetoAVencer {
  clientId: string;
  nome: string;
  /** Rótulo da raia (status do projeto) — a coluna ETAPA. */
  etapa: string;
  etapaCor: string;
  /** Data da tarefa aberta que vence primeiro (YYYY-MM-DD). */
  vencimento: string;
  /** Dias até lá. Negativo = atrasado. */
  dias: number;
  situacao: Situacao;
  /** A tarefa que está segurando essa data. */
  tarefa: string;
  responsavel: string | null;
  fechadas: number;
  total: number;
}

export interface ResumoAVencer {
  itens: ProjetoAVencer[];
  atrasados: number;
  /** Projetos em aberto que não têm nenhuma tarefa com data. */
  semData: number;
}

/** Até quantos dias à frente ainda conta como "a vencer". */
const JANELA_PADRAO = 14;

/** Dentro de quantos dias o prazo já pede atenção. */
const ATENCAO_ATE = 3;

/**
 * Raias de projeto terminado. Elas existem no quadro (são 2 dos 14 status),
 * mas não têm o que vencer — e sem este corte cada projeto entregue entrava
 * na conta de "sem data", inflando o número que serve justamente pra
 * apontar projeto esquecido.
 *
 * Derivado de TASK_STATUS_GROUP pra não ficar defasado se um status novo
 * nascer fechado.
 */
const RAIAS_FECHADAS = new Set(
  (Object.keys(TASK_STATUS_GROUP) as TaskStatus[])
    .filter((s) => TASK_STATUS_GROUP[s] === "fechado")
    .map(statusLaneId)
);

export function ehRaiaFechada(id: string | undefined): boolean {
  return Boolean(id && RAIAS_FECHADAS.has(id));
}

export function situacaoDoPrazo(dias: number): Situacao {
  if (dias < 0) return "atrasado";
  if (dias <= ATENCAO_ATE) return "atencao";
  return "no-prazo";
}

/** Diferença em dias inteiros, imune a fuso: as duas datas viram meio-dia UTC. */
export function diasEntre(de: string, ate: string): number | null {
  const a = new Date(`${ate}T12:00:00Z`).getTime();
  const b = new Date(`${de}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

type GrupoDeRaia = {
  /** Id da raia (`status-<valor>`). Ausente só nos testes de unidade. */
  id?: string;
  label: string;
  color: string;
  clients: {
    id: string;
    nome: string;
    empresa: string | null;
    progresso: { total: number; fechadas: number } | null;
  }[];
};

type TarefaComPrazo = {
  client_id: string | null;
  titulo: string;
  status: string;
  responsavel: string | null;
  data_vencimento: string | null;
};

export function montarProjetosAVencer(
  grupos: GrupoDeRaia[],
  tarefas: TarefaComPrazo[],
  hoje: string,
  opcoes: { janelaDias?: number; limite?: number; clientesPermitidos?: Set<string> | null } = {}
): ResumoAVencer {
  const janela = opcoes.janelaDias ?? JANELA_PADRAO;
  const permitidos = opcoes.clientesPermitidos ?? null;

  // A tarefa aberta com a data mais próxima, por cliente.
  const maisProxima = new Map<string, TarefaComPrazo>();
  for (const t of tarefas) {
    if (!t.client_id || !t.data_vencimento) continue;
    if (isClosedTaskStatus(t.status as TaskStatus)) continue;
    const atual = maisProxima.get(t.client_id);
    if (!atual || (t.data_vencimento as string) < (atual.data_vencimento as string)) {
      maisProxima.set(t.client_id, t);
    }
  }

  const itens: ProjetoAVencer[] = [];
  let semData = 0;

  for (const g of grupos) {
    if (ehRaiaFechada(g.id)) continue;
    for (const c of g.clients) {
      if (permitidos && !permitidos.has(c.id)) continue;
      const t = maisProxima.get(c.id);
      if (!t) {
        semData += 1;
        continue;
      }
      const dias = diasEntre(hoje, t.data_vencimento as string);
      // Data que o banco não consegue interpretar não vira linha silenciosa
      // com "NaN dias": entra na conta dos sem data, que é o que ela é.
      if (dias === null) {
        semData += 1;
        continue;
      }
      if (dias > janela) continue;
      itens.push({
        clientId: c.id,
        nome: c.empresa?.trim() || c.nome,
        etapa: g.label,
        etapaCor: g.color,
        vencimento: t.data_vencimento as string,
        dias,
        situacao: situacaoDoPrazo(dias),
        tarefa: t.titulo,
        responsavel: t.responsavel,
        fechadas: c.progresso?.fechadas ?? 0,
        total: c.progresso?.total ?? 0,
      });
    }
  }

  // Mais apertado primeiro; empate desempata pelo nome, pra a ordem não
  // dançar entre dois carregamentos.
  itens.sort((a, b) => a.dias - b.dias || a.nome.localeCompare(b.nome, "pt-BR"));

  const atrasados = itens.filter((i) => i.situacao === "atrasado").length;
  const limite = opcoes.limite;
  return {
    itens: limite ? itens.slice(0, limite) : itens,
    atrasados,
    semData,
  };
}
