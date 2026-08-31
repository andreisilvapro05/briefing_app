"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getCurrentMember, getVisibleClientIds } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Marca uma notificação como lida (dispensar do banner do /admin).
 */
export async function dismissNotificationAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  revalidatePath("/admin");
}

/**
 * Marca TODAS as notificações não lidas como lidas. Útil pra "marcar tudo
 * como lido" quando admin já viu o banner.
 */
export async function dismissAllNotificationsAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const service = createSupabaseServiceRoleClient();
  await service
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  revalidatePath("/admin");
}

export interface GlobalSearchResults {
  clientes: { id: string; nome: string; empresa: string | null }[];
  tarefas: {
    id: string;
    titulo: string;
    clientId: string;
    clientNome: string;
    status: string;
  }[];
  documentos: {
    id: string;
    kind: "ei" | "briefing";
    clientId: string;
    clientNome: string;
  }[];
}

const EMPTY_RESULTS: GlobalSearchResults = {
  clientes: [],
  tarefas: [],
  documentos: [],
};

/**
 * Busca unificada (Clientes/Tarefas/Documentos) pro command palette do
 * admin — reaproveita getVisibleClientIds pra "basico" não ver resultado
 * de cliente fora do escopo dele nem por busca.
 */
export async function globalSearchAction(
  query: string,
  urlKey: string | null
): Promise<GlobalSearchResults> {
  const member = await getCurrentMember({ urlKey });
  if (!member) return EMPTY_RESULTS;

  const q = query.trim();
  if (q.length < 2) return EMPTY_RESULTS;

  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && visibleIds.size === 0) return EMPTY_RESULTS;

  const service = createSupabaseServiceRoleClient();
  const like = `%${q}%`;

  let clientesQuery = service
    .from("clients")
    .select("id, nome, empresa")
    .or(`nome.ilike.${like},empresa.ilike.${like},email.ilike.${like}`)
    .limit(6);
  if (visibleIds) clientesQuery = clientesQuery.in("id", Array.from(visibleIds));
  const { data: clientesData } = await clientesQuery;
  const clientes = (
    (clientesData as { id: string; nome: string | null; empresa: string | null }[]) ?? []
  ).map((c) => ({ id: c.id, nome: c.empresa || c.nome || "Sem nome", empresa: c.empresa }));

  let tarefasQuery = service
    .from("project_tasks")
    .select("id, titulo, status, client_id, clients(nome, empresa)")
    .ilike("titulo", like)
    .limit(6);
  if (visibleIds) tarefasQuery = tarefasQuery.in("client_id", Array.from(visibleIds));
  const { data: tarefasData } = await tarefasQuery;
  const tarefas = (
    (tarefasData as unknown as {
      id: string;
      titulo: string;
      status: string;
      client_id: string;
      clients: { nome: string | null; empresa: string | null } | null;
    }[]) ?? []
  )
    .filter((t) => t.clients)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      status: t.status,
      clientId: t.client_id,
      clientNome: t.clients!.empresa || t.clients!.nome || "Sem nome",
    }));

  // Documentos não têm título próprio na prática — filtra pelo nome do
  // cliente dono, não pelo próprio documento (ver ei-documents.ts).
  let docsQuery = service
    .from("ei_documents")
    .select("id, kind, client_id, clients!inner(nome, empresa)")
    .not("client_id", "is", null)
    .or(`nome.ilike.${like},empresa.ilike.${like}`, { foreignTable: "clients" })
    .limit(6);
  if (visibleIds) docsQuery = docsQuery.in("client_id", Array.from(visibleIds));
  const { data: docsData } = await docsQuery;
  const documentos = (
    (docsData as unknown as {
      id: string;
      kind: "ei" | "briefing";
      client_id: string;
      clients: { nome: string | null; empresa: string | null } | null;
    }[]) ?? []
  )
    .filter((d) => d.clients)
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      clientId: d.client_id,
      clientNome: d.clients!.empresa || d.clients!.nome || "Sem nome",
    }));

  return { clientes, tarefas, documentos };
}
