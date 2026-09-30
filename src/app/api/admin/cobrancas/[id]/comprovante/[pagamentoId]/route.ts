import { type NextRequest } from "next/server";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import type { PagamentoHistorico } from "@/lib/cobrancas-mensais";

/**
 * Serve o comprovante de um pagamento de cobrança recorrente.
 *
 * Mesmo desenho da rota dos comprovantes de projeto
 * (/api/admin/comprovantes/[id]): o bucket é PRIVADO porque comprovante é
 * documento financeiro — mostra banco, valor, às vezes a chave Pix — e não
 * pode ficar numa URL pública adivinhável.
 *
 * Exige acesso financeiro. Cobrança LIGADA a um cliente também respeita o
 * escopo do membro; cobrança avulsa (client_id nulo) não tem escopo a
 * respeitar, e por isso o acesso financeiro é a única porta.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagamentoId: string }> }
) {
  const { id, pagamentoId } = await params;
  const url = new URL(request.url);
  const member = await getCurrentMember({ urlKey: url.searchParams.get("key") });
  if (!member) return errorResponse("unauthenticated", 401);
  if (!hasFinanceAccess(member)) return errorResponse("forbidden", 403);

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("cobrancas_mensais")
    .select("client_id, historico")
    .eq("id", id)
    .maybeSingle();

  const cobranca = data as {
    client_id: string | null;
    historico: PagamentoHistorico[] | null;
  } | null;
  if (!cobranca) return errorResponse("nao-encontrado", 404);

  if (cobranca.client_id) {
    const visibleIds = await getVisibleClientIds(member);
    if (visibleIds && !visibleIds.has(cobranca.client_id)) {
      return errorResponse("forbidden", 403);
    }
  }

  const pagamento = (cobranca.historico ?? []).find((h) => h.id === pagamentoId);
  if (!pagamento?.arquivoPath) return errorResponse("nao-encontrado", 404);

  const { data: arquivo, error } = await service.storage
    .from("comprovantes")
    .download(pagamento.arquivoPath);
  if (error || !arquivo) {
    logServerError("cobrancas.comprovante-download", error);
    return errorResponse("nao-encontrado", 404);
  }

  const buf = await arquivo.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": pagamento.arquivoTipo || "application/octet-stream",
      // inline: conferir um print é o que se quer, não baixar.
      "Content-Disposition": `inline; filename="${(
        pagamento.arquivoNome ?? "comprovante"
      ).replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
