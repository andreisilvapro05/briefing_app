import { createSupabaseServiceRoleClient } from "./supabase/server";
import { TEAM_MEMBERS } from "./project-tasks";

/**
 * Caixa de entrada POR PESSOA — "te passaram uma demanda", "comentaram na
 * sua", "mudaram o prazo".
 *
 * Diferente de `admin_notifications`, que é um mural: lá o `read_at` é único,
 * então quando alguém dispensa, some pra todo mundo. Aqui cada linha tem um
 * destinatário e é lida só por ele.
 *
 * O destinatário é o valor de TEAM_MEMBERS (o mesmo texto gravado em
 * `project_tasks.responsavel`), não o id de `team_members`: é assim que a
 * demanda é roteada, e quem ainda não tem login (Tainá) também acumula os
 * avisos, que aparecem no dia em que entrar.
 */

export type MemberNotificationKind =
  | "tarefa.atribuida"
  | "tarefa.comentario"
  | "tarefa.status"
  | "tarefa.prazo"
  | "tarefa.clickup";

export interface MemberNotificationRow {
  id: string;
  kind: MemberNotificationKind;
  task_id: string | null;
  client_id: string | null;
  actor: string | null;
  title: string;
  message: string | null;
  created_at: string;
}

interface NotifyInput {
  /** Valor de TEAM_MEMBERS — quem recebe. */
  recipient: string | null | undefined;
  kind: MemberNotificationKind;
  title: string;
  message?: string | null;
  taskId?: string | null;
  clientId?: string | null;
  /** Quem causou. Avisar alguém do que ela mesma fez é ruído. */
  actor?: string | null;
}

/**
 * Best-effort, igual a createAdminNotification: um aviso que não gravou não
 * pode derrubar a ação que o gerou (salvar a tarefa é que importa).
 */
export async function notifyMember(input: NotifyInput): Promise<void> {
  const recipient = (input.recipient ?? "").trim();
  if (!recipient) return;
  // Não avisa a pessoa sobre a própria ação.
  if (input.actor && input.actor === recipient) return;

  try {
    const service = createSupabaseServiceRoleClient();
    const { error } = await service.from("member_notifications").insert({
      recipient,
      kind: input.kind,
      task_id: input.taskId ?? null,
      client_id: input.clientId ?? null,
      actor: input.actor ?? null,
      title: input.title,
      message: input.message ?? null,
    });
    if (error) console.warn("[member-notifications] insert:", error.message);
  } catch (err) {
    console.warn("[member-notifications] silenciado:", err);
  }
}

/** Nome de exibição de um valor de TEAM_MEMBERS ("valeria" → "Valéria"). */
export function nomeDoMembro(valor: string | null | undefined): string {
  if (!valor) return "Alguém";
  return TEAM_MEMBERS.find((m) => m.value === valor)?.label ?? valor;
}

export async function listMemberNotifications(
  recipient: string | null,
  limit = 20
): Promise<MemberNotificationRow[]> {
  if (!recipient) return [];
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("member_notifications")
    .select("id, kind, task_id, client_id, actor, title, message, created_at")
    .eq("recipient", recipient)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as MemberNotificationRow[] | null) ?? [];
}

/**
 * Marca como lida. Sempre filtra por `recipient` junto do id: sem isso, quem
 * conhecesse um id apagaria o aviso de outra pessoa.
 */
export async function markMemberNotificationRead(
  recipient: string,
  notificationId: string
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  await service
    .from("member_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient", recipient);
}

export async function markAllMemberNotificationsRead(
  recipient: string
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  await service
    .from("member_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient", recipient)
    .is("read_at", null);
}
