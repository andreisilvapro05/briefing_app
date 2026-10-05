import { createSupabaseServiceRoleClient } from "./supabase/server";
import { PROJECT_TYPE_LABELS } from "./briefing-labels";
import { DEFAULT_TASK_STATUS, type ProjectTask } from "./project-tasks";
import {
  GENERAL_LANES,
  nomeDoProjeto,
  isClientStuck,
  laneForClient,
  type ClientForLane,
} from "./workflow-lanes";
import { getTasksByClient, taskProgress } from "./project-tasks-server";
import { linhaDoProjeto } from "./linha-do-projeto";
import { getAllEIDocumentIdsByClient } from "./ei-documents-server";
import { clientesComListaDeMateriais } from "./materiais-cliente-server";
import type { LaneGroup } from "@/components/admin/status-pie-board";

/**
 * Monta os grupos por lane (status) pro StatusPieBoard — usado tanto pela
 * Lista por status quanto pela Visão Geral, pra manter a mesma pizza
 * selecionável nas duas telas em vez de duplicar/divergir a lógica.
 */

const TONE_HEX: Record<string, string> = {
  slate: "#94a3b8",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  cyan: "#06b6d4",
  yellow: "#eab308",
  pink: "#ec4899",
  violet: "#8b5cf6",
  fuchsia: "#d946ef",
  amber: "#f59e0b",
  red: "#ef4444",
  bordo: "#9f1239",
  orange: "#f97316",
  emerald: "#10b981",
  green: "#16a34a",
  rose: "#f43f5e",
  lime: "#84cc16",
  teal: "#14b8a6",
};

/**
 * @param pessoa recorte da barra "Filtrar por responsável". Quando dado, as
 * colunas Responsável/Início/Vencimento/Prioridade da linha saem da tarefa
 * DESSA pessoa no projeto — é o que faz a "Lista Andrei" do ClickUp mostrar
 * a data dele, e não a de quem estiver com a próxima etapa.
 */
export async function getLaneGroups(
  visibleIds?: Set<string> | null,
  pessoa?: string | null
): Promise<LaneGroup[]> {
  const service = createSupabaseServiceRoleClient();

  let clientsQuery = service
    .from("clients")
    .select(
      "id, nome, empresa, project_type, status, current_stage_index, briefing_submitted_at, contrato_preenchido_at, chamada_agendada_at, contrato_status, pagamento_total, pagamento_pago, last_client_activity_at, created_at, responsavel, clickup_nome, nome_exibicao, data_inicial, data_vencimento"
    )
    // Arquivado não entra em nenhuma lista de trabalho: é projeto que não
    // vai acontecer (desistência, abandono). O status real de onde ele
    // parou fica guardado — ver migration 20260928160000.
    .is("arquivado_em", null)
    .order("created_at", { ascending: false });
  if (visibleIds) clientsQuery = clientsQuery.in("id", Array.from(visibleIds));

  // As três consultas são independentes. A dos documentos de EI dependia da
  // lista de clientes só pra montar o filtro `.in()` — buscar todos de uma
  // vez (tabela pequena) tira uma ida ao banco do caminho crítico.
  const [{ data }, tasksByClient, eiDocIds, comListaDeMateriais] =
    visibleIds && visibleIds.size === 0
      ? [
          { data: [] },
          new Map<string, ProjectTask[]>(),
          new Map<string, string>(),
          new Set<string>(),
        ]
      : await Promise.all([
          clientsQuery,
          getTasksByClient(),
          getAllEIDocumentIdsByClient(),
          clientesComListaDeMateriais(),
        ]);

  const clients = (data as ClientForLane[]) ?? [];

  const byLane = new Map<string, ClientForLane[]>();
  GENERAL_LANES.forEach((l) => byLane.set(l.id, []));
  clients.forEach((c) => byLane.get(laneForClient(c))?.push(c));

  return GENERAL_LANES.map((lane) => ({
    id: lane.id,
    label: lane.label,
    color: TONE_HEX[lane.tone] ?? "#94a3b8",
    description: lane.description ?? null,
    clients: (byLane.get(lane.id) ?? []).map((c) => {
      const total = Number(c.pagamento_total) || 0;
      const pago = Number(c.pagamento_pago) || 0;
      const tasks = tasksByClient.get(c.id);
      return {
        id: c.id,
        nome: c.nome,
        /**
         * Precedência do nome na lista: o escrito à mão ganha de tudo, o
         * do ClickUp vem depois, o cadastro fica por último.
         *
         * `nome_exibicao` é o único que gente escreve e o sync nunca toca —
         * sem ele, corrigir um nome aqui seria desfeito na próxima
         * sincronização, em silêncio.
         */
        empresa: nomeDoProjeto(c),
        tipo: c.project_type
          ? PROJECT_TYPE_LABELS[c.project_type] ?? c.project_type
          : "—",
        // O valor cru (não o rótulo) vai junto porque a tela precisa saber
        // se o projeto está SEM tipo pra marcá-lo como incompleto — e o
        // <select> de ajuste precisa do value.
        projectType: c.project_type ?? null,
        status: c.status || DEFAULT_TASK_STATUS,
        pagamento: total > 0 ? `${Math.round((pago / total) * 100)}%` : "—",
        created_at: c.created_at,
        progresso: tasks ? taskProgress(tasks) : null,
        // As colunas que o ClickUp mostra na linha do projeto. Derivadas
        // aqui, no servidor, porque as subtarefas só chegam ao navegador
        // quando o accordion é aberto — ver o comentário logo abaixo.
        /**
         * O responsável do PROJETO é o gestor (clients.responsavel), não
         * quem está com a etapa da vez. Karine (28/09): "sempre mostra o
         * Andrei como responsável principal — gestor de projetos". Só cai
         * pro responsável da tarefa quando o projeto ainda não tem gestor
         * definido; as datas e a prioridade seguem vindo da tarefa, que é
         * de onde elas existem.
         */
        linha: (() => {
          const base = linhaDoProjeto(tasks ?? [], pessoa);
          const p = c as {
            responsavel?: string | null;
            data_inicial?: string | null;
            data_vencimento?: string | null;
          };
          /**
           * O que o PROJETO tem de próprio vence o que foi derivado das
           * subtarefas. No ClickUp responsável e datas moram na tarefa-mãe,
           * e derivar da subtarefa deixava as colunas vazias em todo
           * projeto sem subtarefa datada — o caso dos quatro parados
           * (Karine, 28/09: "não está igual, e as datas").
           */
          return {
            ...base,
            responsavel: p.responsavel ?? base.responsavel,
            dataInicial: p.data_inicial ?? base.dataInicial,
            dataVencimento: p.data_vencimento ?? base.dataVencimento,
          };
        })(),
        // As tarefas NÃO vão no payload: o accordion busca sob demanda em
        // /api/admin/client-tasks quando é aberto. Mandar o array completo
        // de todos os clientes inflava a resposta destas telas (medido:
        // 217KB em /admin/lista e 229KB em /admin/visao-geral, contra 69KB
        // de Cobranças) — e o accordion nasce fechado.
        parado: isClientStuck(c),
        eiDocId: eiDocIds.get(c.id) ?? null,
        nomeExibicao:
          (c as { nome_exibicao?: string | null }).nome_exibicao ?? null,
        // 0 ou 1: a tela só quer saber se a lista existe. Ver
        // `semListaDeMateriais` em projetos-incompletos.ts.
        totalMateriais: comListaDeMateriais.has(c.id) ? 1 : 0,
      };
    }),
  }));
}
