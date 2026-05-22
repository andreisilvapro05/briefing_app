import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Devolve todas as respostas do briefing de um cliente, dado o `clientId`.
 *
 * Usado ao entrar de outro aparelho (/entrar) e ao abrir o painel — popula o
 * localStorage pra que o cliente (ou um sócio convidado) continue de onde parou.
 *
 * Resposta: { responses: { "<bloco>.<campo>": valor, ... } }.
 * Em modo demo (sem Supabase) responde { responses: {} }.
 */

const Body = z.object({
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  let service: ReturnType<typeof createSupabaseServiceRoleClient>;
  try {
    service = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json({ responses: {}, mode: "demo" });
  }

  const { data, error } = await service
    .from("briefing_responses")
    .select("field_id, value")
    .eq("client_id", parsed.clientId);

  if (error) {
    logServerError("briefing.load", error);
    return errorResponse("query-failed", 500, error);
  }

  const responses: Record<string, unknown> = {};
  for (const row of data ?? []) {
    if (row.field_id) responses[row.field_id] = row.value;
  }

  return NextResponse.json({ responses });
}
