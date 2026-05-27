import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

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

  return NextResponse.json({ ok: true });
}
