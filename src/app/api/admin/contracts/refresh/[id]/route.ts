import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getDocument } from "@/lib/autentique";
import {
  buildClientePayload,
  sendDashboardWebhook,
} from "@/lib/dashboard-webhook";

/**
 * Consulta o estado atual do contrato no Autentique e atualiza o banco.
 * Útil pra "Atualizar status" no admin (enquanto não temos webhook).
 *
 * Admin-only.
 */

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const admin = await getCurrentMember({
    urlKey: url.searchParams.get("key"),
  });
  if (!admin) return errorResponse("unauthenticated", 401);
  if (!hasFinanceAccess(admin)) return errorResponse("forbidden", 403);

  const service = createSupabaseServiceRoleClient();
  const { data: client } = await service
    .from("clients")
    .select("autentique_document_id, contrato_status, email")
    .eq("id", id)
    .maybeSingle();
  if (!client?.autentique_document_id) {
    return errorResponse("no-contract", 404);
  }
  const previousStatus = client.contrato_status ?? null;

  let status;
  try {
    status = await getDocument(client.autentique_document_id);
  } catch (err) {
    logServerError("contracts.refresh.autentique", err);
    return NextResponse.json(
      {
        error: "autentique-failed",
        _debug: err instanceof Error ? err.message : String(err),
        docId: client.autentique_document_id,
      },
      { status: 502 }
    );
  }

  const rejected = status.signers.some((s) => s.rejectedAt);
  const newStatus = rejected
    ? "rejeitado"
    : status.fullySigned
      ? "assinado"
      : "pendente";

  // Link de assinatura do signatário CLIENTE (pra reenviar manualmente e
  // mostrar no painel dele) — casa pelo e-mail cadastrado.
  const clientEmail = (client.email ?? "").trim().toLowerCase();
  const clientSignLink = clientEmail
    ? status.signers.find((s) => s.email.trim().toLowerCase() === clientEmail)
        ?.signLink
    : undefined;

  const { error: updErr } = await service
    .from("clients")
    .update({
      contrato_status: newStatus,
      contrato_signed_url: status.signedUrl ?? null,
      ...(clientSignLink ? { contrato_link_assinatura: clientSignLink } : {}),
    })
    .eq("id", id);
  if (updErr) {
    logServerError("contracts.refresh.persist", updErr);
    return errorResponse("save-failed", 500, updErr);
  }

  // Webhook outbound: só dispara contrato.assinado quando o status MUDA pra
  // assinado (evita disparar a cada refresh).
  if (newStatus === "assinado" && previousStatus !== "assinado") {
    const { data: fresh } = await service
      .from("clients")
      .select(
        "id, nome, email, empresa, whatsapp, cpf, cnpj, razao_social, endereco, cep, project_type, autentique_document_id, contrato_signed_url, contrato_dados"
      )
      .eq("id", id)
      .maybeSingle();
    if (fresh) {
      const dados =
        (fresh.contrato_dados as Record<string, unknown> | null) ?? {};
      void sendDashboardWebhook({
        event: "contrato.assinado",
        emittedAt: new Date().toISOString(),
        source: "briefing_app",
        clientId: id,
        cliente: buildClientePayload(fresh),
        contrato: {
          autentique_document_id: fresh.autentique_document_id ?? null,
          signed_url: fresh.contrato_signed_url ?? null,
          pacote_nome: (dados["pacote_nome"] as string) ?? null,
          valor_parcelamento:
            (dados["valor_parcelamento"] as string) ?? null,
          prazo_execucao: (dados["prazo_execucao"] as string) ?? null,
          escopo_projeto: (dados["escopo_projeto"] as string) ?? null,
          link_parcelamento: (dados["link_parcelamento"] as string) ?? null,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    signedUrl: status.signedUrl,
    signers: status.signers,
  });
}
