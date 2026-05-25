import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Upload do modelo de contrato (.docx) pro bucket privado contracts-templates.
 *
 * Substitui o template existente (path fixo: modelo.docx). Admin-only.
 */

const TEMPLATE_PATH = "modelo.docx";
const BUCKET = "contracts-templates";
const MAX_BYTES = 5 * 1024 * 1024;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const urlKey = url.searchParams.get("key");
  const admin = await getAdminUser({ urlKey });
  if (!admin) return errorResponse("unauthenticated", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return errorResponse("invalid-payload", 400, err);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return errorResponse("invalid-file", 400);
  if (file.size === 0) return errorResponse("empty-file", 400);
  if (file.size > MAX_BYTES) return errorResponse("file-too-large", 413);

  const lname = file.name.toLowerCase();
  if (!lname.endsWith(".docx")) {
    return errorResponse("unsupported-format", 415);
  }

  const service = createSupabaseServiceRoleClient();
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await service.storage
    .from(BUCKET)
    .upload(TEMPLATE_PATH, new Uint8Array(arrayBuffer), {
      contentType: file.type || DOCX_MIME,
      upsert: true,
    });

  if (error) {
    logServerError("contracts.template.upload", error);
    return errorResponse("upload-failed", 500, error);
  }

  return NextResponse.json({
    ok: true,
    path: TEMPLATE_PATH,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  });
}
