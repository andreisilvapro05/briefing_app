import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, isProduction, logServerError } from "@/lib/api-helpers";

/**
 * Upload de arquivo para Supabase Storage.
 *
 * Em PRODUÇÃO:
 * - Exige usuário autenticado (cookie de sessão Supabase).
 * - Bucket é fixo (env.storageBucket) — input do client é ignorado.
 * - Path é prefixado com auth_user_id (combina com RLS storage policy).
 *
 * Em DEV (NODE_ENV !== "production"):
 * - Permite upload anônimo sob `demo/...` para desenvolvimento local.
 *
 * SEGURANÇA:
 * - Limite de 25 MB por arquivo (enforced server-side).
 * - Allowlist de MIME types.
 * - Sanitização anti path-traversal no pathPrefix.
 */

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = [
  "image/",
  "audio/",
  "video/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.oasis",
  "application/zip",
  "application/x-zip-compressed",
  "font/",
  "application/font-",
  "application/x-font",
  "text/plain",
  "text/markdown",
  "text/rtf",
  "application/rtf",
  "application/octet-stream",
];

function isMimeAllowed(mime: string): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export async function POST(request: NextRequest) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return errorResponse("storage-not-configured", 503);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const pathPrefix = (formData.get("pathPrefix") as string) || "";

  // Bucket é SEMPRE o configurado pelo servidor — não confiamos no client.
  const bucket = env.storageBucket;

  if (!(file instanceof File)) {
    return errorResponse("invalid-file", 400);
  }

  if (file.size > MAX_BYTES) {
    return errorResponse("file-too-large", 413);
  }

  if (file.type && !isMimeAllowed(file.type)) {
    return errorResponse("unsupported-mime", 415);
  }

  // Sanitização anti path-traversal. Rejeita inputs maliciosos.
  const safePrefix = pathPrefix
    .replace(/\.{2,}/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/^\/+/, "")
    .slice(0, 100);
  if (pathPrefix.length > 0 && safePrefix !== pathPrefix) {
    return errorResponse("invalid-path-prefix", 400);
  }

  // Resolve identidade
  let owner: string;
  let clientId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      owner = userData.user.id;
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      clientId = client?.id ?? null;
    } else if (isProduction()) {
      // Em produção, exigimos auth — sem auth, recusa.
      return errorResponse("unauthenticated", 401);
    } else {
      // Em dev, permite modo demo para facilitar desenvolvimento local.
      owner = "demo";
    }
  } catch (err) {
    if (isProduction()) {
      logServerError("upload.auth", err);
      return errorResponse("auth-failed", 500);
    }
    owner = "demo";
  }

  // Path: {owner}/{safePrefix}/{timestamp}-{nome-sanitizado}
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
  const ts = Date.now();
  const prefix = safePrefix ? `${safePrefix}/` : "";
  const objectPath = `${owner}/${prefix}${ts}-${safeName}`;

  const service = createSupabaseServiceRoleClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await service.storage
    .from(bucket)
    .upload(objectPath, new Uint8Array(arrayBuffer), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    logServerError("upload.storage", error);
    return errorResponse("upload-failed", 500, error);
  }

  const { data: urlData } = service.storage
    .from(bucket)
    .getPublicUrl(objectPath);

  if (clientId) {
    await service.from("briefing_files").insert({
      client_id: clientId,
      field_id: safePrefix,
      storage_path: objectPath,
      public_url: urlData.publicUrl,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
  }

  return NextResponse.json({
    url: urlData.publicUrl,
    path: objectPath,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    bucket,
  });
}
