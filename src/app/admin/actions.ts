"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getCurrentMember, getVisibleClientIds } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { logServerError } from "@/lib/api-helpers";

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

export interface AdminNotificationRow {
  id: string;
  client_id: string | null;
  kind: string;
  title: string;
  message: string | null;
  created_at: string;
}

/**
 * Notificações não lidas pro sino do topbar (visível em toda página admin,
 * não só em Clientes) — escopado por getVisibleClientIds, igual busca
 * global, pra "basico" não ver aviso de cliente fora do escopo dele.
 */
export async function getUnreadAdminNotificationsAction(
  urlKey: string | null
): Promise<AdminNotificationRow[]> {
  const member = await getCurrentMember({ urlKey });
  if (!member) return [];

  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && visibleIds.size === 0) return [];

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("admin_notifications")
    .select("id, client_id, kind, title, message, created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (data as AdminNotificationRow[]) ?? [];
  if (!visibleIds) return rows;
  return rows.filter((n) => !n.client_id || visibleIds.has(n.client_id));
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

export interface OwnProfile {
  name: string;
  email: string;
  fotoUrl: string | null;
  initials: string;
  // Só quem entrou com identidade própria (Supabase Auth / Caixa 0) pode
  // trocar a própria foto — sessão de senha compartilhada não tem "dono".
  canEditPhoto: boolean;
}

/**
 * Perfil da pessoa logada, pro avatar do topbar (foto real quando tem,
 * iniciais quando não tem). Busca no cliente (ProfileAvatar) igual o sino
 * de notificações, pra não precisar tocar nos ~18 call-sites do AdminShell.
 */
export async function getOwnProfileAction(
  urlKey: string | null
): Promise<OwnProfile | null> {
  const member = await getCurrentMember({ urlKey });
  if (!member) return null;
  return {
    name: member.name,
    email: member.email,
    fotoUrl: member.fotoUrl,
    initials: (member.name || member.email || "F").slice(0, 2).toUpperCase(),
    canEditPhoto: member.source === "supabase",
  };
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Troca a foto de perfil da PRÓPRIA pessoa logada (nunca de outro membro —
 * a linha atualizada é sempre `member.id` resolvido pela sessão, nunca um
 * id vindo do form). Upload igual ao padrão de /api/admin/conteudo/upload,
 * como Server Action pra não precisar de rota HTTP separada.
 */
export async function updateOwnPhotoAction(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) return { ok: false, error: "unauthenticated" };
  if (member.source !== "supabase") {
    return { ok: false, error: "sessao-sem-identidade-propria" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "no-file" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "not-image" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "too-large" };

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return { ok: false, error: "storage-not-configured" };
  }

  const service = createSupabaseServiceRoleClient();
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
  const objectPath = `membros/${member.id}-${Date.now()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await service.storage
    .from(env.storageBucket)
    .upload(objectPath, bytes, {
      contentType: file.type || "image/*",
      upsert: false,
    });
  if (error) {
    logServerError("membros.foto.upload", error);
    return { ok: false, error: "upload-failed" };
  }

  const { data } = service.storage.from(env.storageBucket).getPublicUrl(objectPath);

  const { error: updErr } = await service
    .from("team_members")
    .update({ foto_url: data.publicUrl })
    .eq("id", member.id);
  if (updErr) {
    logServerError("membros.foto.persist", updErr);
    return { ok: false, error: "save-failed" };
  }

  revalidatePath("/admin/membros");
  return { ok: true, url: data.publicUrl };
}

/**
 * Troca o nome de exibição da PRÓPRIA pessoa logada — mesma regra da foto:
 * só quem tem identidade própria (Caixa 0), e sempre a linha `member.id`
 * da sessão, nunca um id vindo do form.
 */
export async function updateOwnNameAction(
  formData: FormData
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) return { ok: false, error: "unauthenticated" };
  if (member.source !== "supabase") {
    return { ok: false, error: "sessao-sem-identidade-propria" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "invalid-name" };
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("team_members")
    .update({ name })
    .eq("id", member.id);
  if (error) {
    logServerError("membros.nome.persist", error);
    return { ok: false, error: "save-failed" };
  }

  revalidatePath("/admin/perfil");
  revalidatePath("/admin/membros");
  return { ok: true, name };
}
