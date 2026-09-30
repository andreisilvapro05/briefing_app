import { type NextRequest } from "next/server";
import { getCurrentMember, getVisibleClientIds } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { lerAnexos } from "@/lib/anexos-demanda";

/**
 * Serve um anexo de demanda. O bucket é PRIVADO: anexo de trabalho interno
 * pode ser contrato, print de conversa, proposta — não pode ficar numa URL
 * pública adivinhável. Mesmo desenho da rota dos comprovantes.
 *
 * Quem vê: qualquer membro logado, respeitando o escopo de clientes. Anexo
 * de demanda INTERNA (client_id nulo) não tem cliente a que se prender, e
 * trabalho interno da agência é visível a quem está logado — mesma regra
 * que a própria tela de Demandas já aplica.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; anexoId: string }> }
) {
  const { taskId, anexoId } = await params;
  const url = new URL(request.url);
  const member = await getCurrentMember({ urlKey: url.searchParams.get("key") });
  if (!member) return errorResponse("unauthenticated", 401);

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("client_id, anexos")
    .eq("id", taskId)
    .maybeSingle();

  const tarefa = data as { client_id: string | null; anexos: unknown } | null;
  if (!tarefa) return errorResponse("nao-encontrado", 404);

  if (tarefa.client_id) {
    const visibleIds = await getVisibleClientIds(member);
    if (visibleIds && !visibleIds.has(tarefa.client_id)) {
      return errorResponse("forbidden", 403);
    }
  }

  const anexo = lerAnexos(tarefa.anexos).find((a) => a.id === anexoId);
  // Link não passa por aqui — o navegador vai direto nele.
  if (!anexo || anexo.tipo !== "arquivo" || !anexo.path) {
    return errorResponse("nao-encontrado", 404);
  }

  const { data: arquivo, error } = await service.storage
    .from("anexos-demandas")
    .download(anexo.path);
  if (error || !arquivo) {
    logServerError("anexo-demanda.download", error);
    return errorResponse("nao-encontrado", 404);
  }

  const buf = await arquivo.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": anexo.mime || "application/octet-stream",
      // inline: conferir um print ou um PDF é o que se quer, não baixar.
      "Content-Disposition": `inline; filename="${anexo.nome.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
