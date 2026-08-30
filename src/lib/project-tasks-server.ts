import { createSupabaseServiceRoleClient } from "./supabase/server";
import {
  currentProductionStatus,
  type ProjectTask,
  type TaskStatus,
} from "./project-tasks";

/**
 * Leitura server-only das tarefas de um cliente (usa service-role). Separado
 * de project-tasks.ts pra não arrastar o cliente Supabase server pro bundle
 * de client components — mesmo padrão de custom-questions-server.ts.
 */
function normalizeTask(row: Record<string, unknown>): ProjectTask {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    titulo: String(row.titulo ?? ""),
    ordem: Number(row.ordem ?? 0),
    status: (row.status as TaskStatus) ?? "a-iniciar",
    prioridade: (row.prioridade as string | null) ?? null,
    responsavel: (row.responsavel as string | null) ?? null,
    data_inicial: (row.data_inicial as string | null) ?? null,
    data_vencimento: (row.data_vencimento as string | null) ?? null,
    concluida_em: (row.concluida_em as string | null) ?? null,
    origem: row.origem === "manual" ? "manual" : "template",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listProjectTasks(
  clientId: string
): Promise<ProjectTask[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeTask);
}

export interface ProjectTaskClient {
  id: string;
  nome: string | null;
  empresa: string | null;
}

/**
 * Todas as tarefas de todos os clientes, com o cliente dono junto — usada
 * pela visão central /admin/tarefas (ver [[feedback_nao_enterrar_por_cliente]]).
 * Sem filtro de client_id — é intencionalmente um full scan de project_tasks,
 * aceitável no volume atual (~35 clientes, algumas dezenas de tarefas cada).
 */
export async function listAllProjectTasks(): Promise<
  (ProjectTask & { client: ProjectTaskClient })[]
> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("*, clients(id, nome, empresa)")
    .order("data_vencimento", { ascending: true, nullsFirst: false });

  return ((data as Record<string, unknown>[]) ?? [])
    .filter((row) => row.clients)
    .map((row) => ({
      ...normalizeTask(row),
      client: row.clients as ProjectTaskClient,
    }));
}

/**
 * Status de produção "atual" de cada cliente que já tem tarefas geradas —
 * usado por `laneForClient` (workflow-lanes.ts) pra categorizar a fase de
 * produção pelos status reais das tarefas, não mais por um heurístico de
 * current_stage_index. Clientes sem nenhuma tarefa não aparecem no Map.
 */
export async function getCurrentProductionStatuses(): Promise<
  Map<string, TaskStatus>
> {
  const all = await listAllProjectTasks();
  const byClient = new Map<string, ProjectTask[]>();
  for (const t of all) {
    const arr = byClient.get(t.client_id);
    if (arr) arr.push(t);
    else byClient.set(t.client_id, [t]);
  }

  const result = new Map<string, TaskStatus>();
  for (const [clientId, tasks] of byClient) {
    const status = currentProductionStatus(tasks);
    if (status) result.set(clientId, status);
  }
  return result;
}
