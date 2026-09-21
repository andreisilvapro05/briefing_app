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
  | "projeto.novo"
  | "material.enviado"
  | "outro";

interface CreateInput {
  clientId: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  /**
   * Não repete o mesmo `kind` pro mesmo cliente dentro dessa janela.
   *
   * Existe por causa do upload: o cliente arrasta 8 arquivos de uma vez e
   * cada um é uma requisição, o que encheria o sino com 8 avisos iguais.
   */
  dedupeMinutes?: number;
}

export async function createAdminNotification(input: CreateInput): Promise<void> {
  try {
    const service = createSupabaseServiceRoleClient();

    if (input.dedupeMinutes && input.dedupeMinutes > 0) {
      const desde = new Date(
        Date.now() - input.dedupeMinutes * 60_000
      ).toISOString();
      const { data: recente } = await service
        .from("admin_notifications")
        .select("id")
        .eq("client_id", input.clientId)
        .eq("kind", input.kind)
        .gte("created_at", desde)
        .limit(1);
      if (Array.isArray(recente) && recente.length > 0) return;
    }

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
