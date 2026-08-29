import { createSupabaseServiceRoleClient } from "./supabase/server";
import type { ProjectTask, TaskStatus } from "./project-tasks";

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
