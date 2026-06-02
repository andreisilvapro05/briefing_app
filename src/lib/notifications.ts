import { createSupabaseServiceRoleClient } from "./supabase/server";

/**
 * Avisos pro admin (banner no /admin).
 *
 * Insere uma linha em `admin_notifications`. Best-effort: nunca propaga erro
 * — falha silenciosa (apenas log) pra não bloquear o fluxo principal
 * (preencher contrato, submeter briefing, etc).
 */

export type NotificationKind =
  | "contrato.preenchido"
  | "briefing.concluido"
  | "pagamento.recebido"
  | "outro";

interface CreateInput {
  clientId: string;
  kind: NotificationKind;
  title: string;
  message?: string;
}

export async function createAdminNotification(input: CreateInput): Promise<void> {
  try {
    const service = createSupabaseServiceRoleClient();
    await service.from("admin_notifications").insert({
      client_id: input.clientId,
      kind: input.kind,
      title: input.title,
      message: input.message ?? null,
    });
  } catch (err) {
    console.warn("[notifications.create] silenciado:", err);
  }
}
