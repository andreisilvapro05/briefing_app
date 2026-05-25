import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getDocument } from "@/lib/autentique";

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
  const admin = await getAdminUser({
    urlKey: url.searchParams.get("key"),
  });
  if (!admin) return errorResponse("unauthenticated", 401);

  const service = createSupabaseServiceRoleClient();
  const { data: client } = await service
    .from("clients")
    .select("autentique_document_id")
    .eq("id", id)
    .maybeSingle();
  if (!client?.autentique_document_id) {
    return errorResponse("no-contract", 404);
  }

  let status;
  try {
    status = await getDocument(client.autentique_document_id);
  } catch (err) {
    logServerError("contracts.refresh.autentique", err);
    return errorResponse("autentique-failed", 502, err);
  }

  const rejected = status.signers.some((s) => s.rejectedAt);
  const newStatus = rejected
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
    .eq("id", id);
  if (updErr) {
    logServerError("contracts.refresh.persist", updErr);
    return errorResponse("save-failed", 500, updErr);
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    signedUrl: status.signedUrl,
    signers: status.signers,
  });
}
