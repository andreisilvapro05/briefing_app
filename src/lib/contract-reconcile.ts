import { createSupabaseServiceRoleClient } from "./supabase/server";
import { getDocument } from "./autentique";
import { createAdminNotification } from "./notifications";
import {
  buildClientePayload,
  sendDashboardWebhook,
} from "./dashboard-webhook";
import { logServerError } from "./api-helpers";

/**
 * Reconcilia o status do contrato de um cliente com o Autentique e persiste.
 *
 * Quando o contrato passa a "assinado" (transição), dispara o webhook
 * contrato.assinado e cria uma notificação pro admin. Idempotente: só age na
 * mudança de estado. Reutilizado pelo cron automático (Caixa 5) — a mesma
 * lógica do botão manual "Atualizar status", agora sem depender do clique.
 */

export type ContratoStatus = "assinado" | "pendente" | "rejeitado";

export interface ReconcileResult {
  ok: boolean;
  status?: ContratoStatus;
  changed?: boolean;
  error?: string;
}

export async function reconcileContract(
  clientId: string
): Promise<ReconcileResult> {
  const service = createSupabaseServiceRoleClient();

  const { data: client } = await service
    .from("clients")
    .select("id, nome, autentique_document_id, contrato_status")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.autentique_document_id) {
    return { ok: false, error: "no-contract" };
  }

  const previousStatus = client.contrato_status ?? null;

  let status;
  try {
    status = await getDocument(client.autentique_document_id);
  } catch (err) {
    logServerError("contract-reconcile.autentique", err);
    return { ok: false, error: "autentique-failed" };
  }

  const rejected = status.signers.some((s) => s.rejectedAt);
  const newStatus: ContratoStatus = rejected
    ? "rejeitado"
    : status.fullySigned
      ? "assinado"
      : "pendente";

  const { error: updErr } = await service
    .from("clients")
    .update({
      contrato_status: newStatus,
      contrato_signed_url: status.signedUrl ?? null,
    })
    .eq("id", clientId);

  if (updErr) {
    logServerError("contract-reconcile.persist", updErr);
    return { ok: false, error: "save-failed" };
  }

  const changed = newStatus !== previousStatus;

  // Transição pra "assinado": notifica o time + dispara webhook (uma vez).
  if (newStatus === "assinado" && previousStatus !== "assinado") {
    await onContractSigned(clientId, client.nome ?? null);
  }

  return { ok: true, status: newStatus, changed };
}

async function onContractSigned(clientId: string, nome: string | null) {
  // Notificação pro admin (best-effort — nunca propaga erro).
  await createAdminNotification({
    clientId,
    kind: "outro",
    title: "Contrato assinado",
    message: nome ? `${nome} assinou o contrato.` : "Contrato assinado.",
  });

  // Webhook contrato.assinado pro app-financeiro.
  const service = createSupabaseServiceRoleClient();
  const { data: fresh } = await service
    .from("clients")
    .select(
      "id, nome, email, empresa, whatsapp, cpf, cnpj, razao_social, endereco, cep, project_type, autentique_document_id, contrato_signed_url, contrato_dados"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (!fresh) return;

  const dados = (fresh.contrato_dados as Record<string, unknown> | null) ?? {};
  void sendDashboardWebhook({
    event: "contrato.assinado",
    emittedAt: new Date().toISOString(),
    source: "briefing_app",
    clientId,
    cliente: buildClientePayload(fresh),
    contrato: {
      autentique_document_id: fresh.autentique_document_id ?? null,
      signed_url: fresh.contrato_signed_url ?? null,
      pacote_nome: (dados["pacote_nome"] as string) ?? null,
      valor_parcelamento: (dados["valor_parcelamento"] as string) ?? null,
      prazo_execucao: (dados["prazo_execucao"] as string) ?? null,
      escopo_projeto: (dados["escopo_projeto"] as string) ?? null,
      link_parcelamento: (dados["link_parcelamento"] as string) ?? null,
    },
  });
}
