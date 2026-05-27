import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import {
  buildClientePayload,
  sendDashboardWebhook,
} from "@/lib/dashboard-webhook";

/**
 * Marca o contrato como assinado manualmente (admin), opcionalmente colando
 * a URL do PDF assinado. Útil quando o cliente assinou fora do fluxo do
 * Autentique, ou quando o webhook/refresh falhou.
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

  let signedUrl: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const raw = typeof body?.signedUrl === "string" ? body.signedUrl.trim() : "";
    signedUrl = raw.length > 0 ? raw : null;
  } catch {
    // body opcional — segue sem URL
  }

  const service = createSupabaseServiceRoleClient();
  const { data: client } = await service
    .from("clients")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!client) return errorResponse("client-not-found", 404);

  // Admin é a fonte da verdade aqui: se não passou URL, limpa qualquer
  // URL anterior (do Autentique etc) pra que o card de download não
  // apareça no painel do cliente.
  const { error: updErr } = await service
    .from("clients")
    .update({
      contrato_status: "assinado",
      contrato_signed_url: signedUrl,
    })
    .eq("id", id);

  if (updErr) {
    logServerError("contracts.mark-signed.persist", updErr);
    return errorResponse("save-failed", 500, updErr);
  }

  // Webhook outbound: contrato assinado (manualmente pelo admin).
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

  return NextResponse.json({ ok: true });
}
