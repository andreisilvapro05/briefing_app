import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Upload de imagem pros cartões do quadro de conteúdo (admin-only).
 * Usa service-role (o admin não tem sessão Supabase, então o /api/upload
 * padrão — que exige sessão — não serve aqui). Devolve a URL pública.
 */

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const user = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!user) return errorResponse("unauthenticated", 401);

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return errorResponse("storage-not-configured", 503);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse("no-file", 400);
  if (!file.type.startsWith("image/")) return errorResponse("not-image", 415);
  if (file.size > MAX_BYTES) return errorResponse("too-large", 413);

  const service = createSupabaseServiceRoleClient();
  const bucket = env.storageBucket;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  const objectPath = `conteudo/${Date.now()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await service.storage
    .from(bucket)
    .upload(objectPath, bytes, {
      contentType: file.type || "image/*",
      upsert: false,
    });
  if (error) {
    logServerError("conteudo.upload", error);
    return errorResponse("upload-failed", 500, error);
  }

  const { data } = service.storage.from(bucket).getPublicUrl(objectPath);
  return NextResponse.json({ url: data.publicUrl });
}
