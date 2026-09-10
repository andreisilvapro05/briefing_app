import { type NextRequest } from "next/server";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Serve um comprovante de pagamento. O bucket é PRIVADO de propósito —
 * comprovante é documento financeiro (mostra banco, valor, às vezes chave
 * Pix), então não pode ficar numa URL pública adivinhável. Mesmo padrão do
 * modelo de contrato: rota autenticada que faz o streaming.
 *
 * Exige acesso financeiro E que o cliente esteja no escopo do membro.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const member = await getCurrentMember({ urlKey: url.searchParams.get("key") });
  if (!member) return errorResponse("unauthenticated", 401);
  if (!hasFinanceAccess(member)) return errorResponse("forbidden", 403);

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("payment_receipts")
    .select("client_id, arquivo_path, arquivo_nome, arquivo_tipo")
    .eq("id", id)
    .maybeSingle();

  const recibo = data as {
    client_id: string;
    arquivo_path: string | null;
    arquivo_nome: string | null;
    arquivo_tipo: string | null;
  } | null;
  if (!recibo?.arquivo_path) return errorResponse("nao-encontrado", 404);

  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && !visibleIds.has(recibo.client_id)) {
    return errorResponse("forbidden", 403);
  }

  const { data: arquivo, error } = await service.storage
    .from("comprovantes")
    .download(recibo.arquivo_path);
  if (error || !arquivo) {
    logServerError("comprovante.download", error);
    return errorResponse("nao-encontrado", 404);
  }

  const buf = await arquivo.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": recibo.arquivo_tipo || "application/octet-stream",
      // inline: abrir no navegador é o que se quer pra conferir um print.
      "Content-Disposition": `inline; filename="${(
        recibo.arquivo_nome ?? "comprovante"
      ).replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
