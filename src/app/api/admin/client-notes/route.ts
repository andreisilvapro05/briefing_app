import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Notas de "Mapeamento de problemas" por cliente (admin-only).
 * GET é tolerante: se a coluna problemas_notas ainda não existir (migration
 * não aplicada), devolve vazio em vez de quebrar.
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const admin = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);

  const clientId = url.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ notas: "" });

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  const row = (data as Record<string, unknown> | null) ?? null;
  const notas =
    row && typeof row.problemas_notas === "string"
      ? (row.problemas_notas as string)
      : "";
  return NextResponse.json({ notas });
}

const Body = z.object({ clientId: z.string().uuid(), notas: z.string() });

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const admin = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("clients")
    .update({ problemas_notas: parsed.notas })
    .eq("id", parsed.clientId);

  if (error) {
    logServerError("client-notes.save", error);
    return errorResponse("save-failed", 500, error);
  }
  return NextResponse.json({ ok: true });
}
