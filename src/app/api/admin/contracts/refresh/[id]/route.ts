import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getDocument } from "@/lib/autentique";
import { onContractSigned } from "@/lib/contract-reconcile";

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
    .select("autentique_document_id, contrato_status, email, nome")
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

  // Contrato acabou de virar assinado: um caminho só pro que isso
  // dispara — aviso no sino, webhook pro financeiro e fechamento da tarefa
  // "Envio Contrato". Antes esta rota só mandava o webhook (código
  // copiado), e o sino nunca tocava: 24 contratos assinados, zero avisos.
  if (newStatus === "assinado" && previousStatus !== "assinado") {
    await onContractSigned(id, client.nome ?? null);
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    signedUrl: status.signedUrl,
    signers: status.signers,
  });
}
