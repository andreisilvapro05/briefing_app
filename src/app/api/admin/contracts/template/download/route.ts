import { type NextRequest } from "next/server";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Baixa o modelo de contrato atual (.docx) do bucket privado
 * contracts-templates. Admin-only (mesma regra financeira do upload).
 * Pra editar o modelo: baixa aqui, edita no Word mantendo as tags
 * {{nome_cliente}}/{{valor_parcelamento}}/etc, e sobe de volta no
 * TemplateUploader.
 */

const TEMPLATE_PATH = "modelo.docx";
const BUCKET = "contracts-templates";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const admin = await getCurrentMember({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);
  if (!hasFinanceAccess(admin)) return errorResponse("forbidden", 403);

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service.storage
    .from(BUCKET)
    .download(TEMPLATE_PATH);

  if (error || !data) {
    logServerError("contracts.template.download", error);
    return errorResponse("template-not-found", 404);
  }

  const buf = await data.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": 'attachment; filename="modelo-contrato-fysi.docx"',
      "Cache-Control": "no-store",
    },
  });
}
