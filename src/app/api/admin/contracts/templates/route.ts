import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-helpers";

/**
 * Lista propostas (contrato_dados) preenchidas pra reusar como template.
 *
 *   GET /api/admin/contracts/templates?key=<admin>
 *     → { templates: [{ id, label, dados }] }
 *
 * Filtra clientes que têm contrato_dados.pacote_nome preenchido.
 * Ordenado por mais recente primeiro.
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const admin = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("clients")
    .select("id, nome, empresa, contrato_dados, created_at")
    .not("contrato_dados", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return errorResponse("query-failed", 500, error);
  }

  // Só clientes que têm pelo menos pacote ou valor preenchido
  type Row = {
    id: string;
    nome: string | null;
    empresa: string | null;
    contrato_dados: Record<string, unknown> | null;
    created_at: string;
  };
  const templates = ((data as Row[]) ?? [])
    .filter((c) => {
      const d = c.contrato_dados as Record<string, unknown> | null;
      if (!d) return false;
      return !!(d.pacote_nome || d.valor_parcelamento || d.escopo_projeto);
    })
    .map((c) => ({
      id: c.id,
      label: c.empresa
        ? `${c.empresa} — ${c.nome ?? ""}`.trim()
        : (c.nome ?? "—"),
      pacote_nome: (c.contrato_dados as Record<string, unknown>)?.pacote_nome ?? "",
      created_at: c.created_at,
      dados: c.contrato_dados,
    }));

  return NextResponse.json({ templates });
}
