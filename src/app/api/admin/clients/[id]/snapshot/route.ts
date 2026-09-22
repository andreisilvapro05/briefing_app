import { NextResponse, type NextRequest } from "next/server";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Snapshot dos dados básicos do cliente — usado pelo botão "Ver como cliente"
 * do admin. Devolve só o que /entrar (login normal por telefone+código)
 * devolveria, pra o admin poder hidratar o localStorage e abrir /dashboard
 * espiando como o cliente vê.
 *
 * Admin-only.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const url = new URL(request.url);
  const { id } = await ctx.params;

  // Alimenta o "Ver como cliente", que abre o painel DELE (contrato, valores
  // e entrega). Mesmo corte do botão na ficha: acesso financeiro + escopo.
  const member = await getCurrentMember({ urlKey: url.searchParams.get("key") });
  if (!member) return errorResponse("unauthenticated", 401);
  if (!hasFinanceAccess(member)) return errorResponse("forbidden", 403);
  const visiveis = await getVisibleClientIds(member);
  if (visiveis && !visiveis.has(id)) {
    return errorResponse("forbidden", 403);
  }
  const service = createSupabaseServiceRoleClient();

  const { data, error } = await service
    .from("clients")
    .select("id, nome, email, empresa, whatsapp, project_type")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logServerError("admin.client.snapshot", error);
    return errorResponse("query-failed", 500, error);
  }
  if (!data) return errorResponse("not-found", 404);

  return NextResponse.json({
    id: data.id,
    nome: data.nome,
    email: data.email || undefined,
    empresa: data.empresa || undefined,
    whatsapp: data.whatsapp,
    projectType: data.project_type || undefined,
  });
}
