import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";

/**
 * Devolve a lista de arquivos enviados pelo cliente.
 *
 * Mesmo padrão de /api/me/stage: aceita clientId no body (sem auth sensível).
 * O clientId é UUID (alta entropia) e a resposta só tem metadados públicos.
 *
 * POST { clientId } → { files: [{ field_id, file_name, public_url, mime_type, size_bytes }] }
 */

const Body = z.object({
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ files: [] });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  try {
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from("briefing_files")
      .select("field_id, file_name, public_url, mime_type, size_bytes, uploaded_at")
      .eq("client_id", parsed.clientId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      logServerError("me.files", error);
      return errorResponse("query-failed", 500, error);
    }

    return NextResponse.json({ files: data ?? [] });
  } catch (err) {
    logServerError("me.files.unexpected", err);
    return errorResponse("internal", 500);
  }
}
