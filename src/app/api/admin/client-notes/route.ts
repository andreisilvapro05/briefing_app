import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentMember, getVisibleClientIds } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Notas de "Mapeamento de problemas" por cliente.
 *
 * O escopo por papel vale aqui também: `getAdminUser` só dizia "é alguém
 * logado", então quem tivesse o UUID de um cliente fora do seu escopo lia e
 * sobrescrevia as notas dele.
 * GET é tolerante: se a coluna problemas_notas ainda não existir (migration
 * não aplicada), devolve vazio em vez de quebrar.
 */

/** Autentica e confirma que o cliente está no escopo de quem pediu. */
async function podeVer(
  urlKey: string | null,
  clientId: string
): Promise<boolean> {
  const member = await getCurrentMember({ urlKey });
  if (!member) return false;
  const visiveis = await getVisibleClientIds(member);
  return !visiveis || visiveis.has(clientId);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ notas: "" });
  if (!(await podeVer(url.searchParams.get("key"), clientId))) {
    return errorResponse("unauthenticated", 401);
  }

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

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }
  if (!(await podeVer(url.searchParams.get("key"), parsed.clientId))) {
    return errorResponse("unauthenticated", 401);
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
