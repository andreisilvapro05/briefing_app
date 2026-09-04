import { createSupabaseServiceRoleClient } from "./supabase/server";
import { PROJECT_TYPE_LABELS } from "./briefing-labels";
import { DEFAULT_TASK_STATUS, type ProjectTask } from "./project-tasks";
import {
  GENERAL_LANES,
  isClientStuck,
  laneForClient,
  type ClientForLane,
} from "./workflow-lanes";
import { getTasksByClient, taskProgress } from "./project-tasks-server";
import { getAllEIDocumentIdsByClient } from "./ei-documents-server";
import type { LaneGroup } from "@/components/admin/status-pie-board";

/**
 * Monta os grupos por lane (status) pro StatusPieBoard — usado tanto pela
 * Lista por status quanto pela Visão Geral, pra manter a mesma pizza
 * selecionável nas duas telas em vez de duplicar/divergir a lógica.
 */

const TONE_HEX: Record<string, string> = {
  slate: "#94a3b8",
  indigo: "#6366f1",
  cyan: "#06b6d4",
  yellow: "#eab308",
  pink: "#ec4899",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  red: "#ef4444",
  orange: "#f97316",
  emerald: "#10b981",
  rose: "#f43f5e",
};

export async function getLaneGroups(
  visibleIds?: Set<string> | null
): Promise<LaneGroup[]> {
  const service = createSupabaseServiceRoleClient();

  let clientsQuery = service
    .from("clients")
    .select(
      "id, nome, empresa, project_type, status, current_stage_index, briefing_submitted_at, contrato_preenchido_at, chamada_agendada_at, contrato_status, pagamento_total, pagamento_pago, last_client_activity_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (visibleIds) clientsQuery = clientsQuery.in("id", Array.from(visibleIds));

  // As três consultas são independentes. A dos documentos de EI dependia da
  // lista de clientes só pra montar o filtro `.in()` — buscar todos de uma
  // vez (tabela pequena) tira uma ida ao banco do caminho crítico.
  const [{ data }, tasksByClient, eiDocIds] =
    visibleIds && visibleIds.size === 0
      ? [
          { data: [] },
          new Map<string, ProjectTask[]>(),
          new Map<string, string>(),
        ]
      : await Promise.all([
          clientsQuery,
          getTasksByClient(),
          getAllEIDocumentIdsByClient(),
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
        empresa: c.empresa,
        tipo: c.project_type
          ? PROJECT_TYPE_LABELS[c.project_type] ?? c.project_type
          : "—",
        status: c.status || DEFAULT_TASK_STATUS,
        pagamento: total > 0 ? `${Math.round((pago / total) * 100)}%` : "—",
        created_at: c.created_at,
        progresso: tasks ? taskProgress(tasks) : null,
        // As tarefas NÃO vão no payload: o accordion busca sob demanda em
        // /api/admin/client-tasks quando é aberto. Mandar o array completo
        // de todos os clientes inflava a resposta destas telas (medido:
        // 217KB em /admin/lista e 229KB em /admin/visao-geral, contra 69KB
        // de Cobranças) — e o accordion nasce fechado.
        parado: isClientStuck(c),
        eiDocId: eiDocIds.get(c.id) ?? null,
      };
    }),
  }));
}
