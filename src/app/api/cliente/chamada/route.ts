import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";

/**
 * Marca a chamada como agendada (ou pulada) pelo cliente.
 *
 * Cliente clica em "Marquei a chamada" no /agendar → POST aqui com
 * { clientId, action: "agendou" | "pulou", chamadaData?, observacoes? }.
 */

const Body = z.object({
  clientId: z.string().uuid(),
  action: z.enum(["agendou", "pulou"]),
  chamadaData: z.string().optional(),
  observacoes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ mode: "demo", ok: true });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const service = createSupabaseServiceRoleClient();

  const { data: existing } = await service
    .from("clients")
    .select("id")
    .eq("id", parsed.clientId)
    .maybeSingle();
  if (!existing) return errorResponse("client-not-found", 404);

  // Pulou = chamada_agendada_at fica null mas registramos a observação
  const updates: Record<string, unknown> = {
    last_client_activity_at: new Date().toISOString(),
  };

  if (parsed.action === "agendou") {
    updates.chamada_agendada_at = new Date().toISOString();
    if (parsed.chamadaData) updates.chamada_data = parsed.chamadaData;
    if (parsed.observacoes) updates.chamada_observacoes = parsed.observacoes;
  } else {
    // Pulou — limpamos a marcação (caso tivesse sido marcada antes)
    updates.chamada_agendada_at = null;
    updates.chamada_observacoes = "[PULOU]";
  }

  const { error } = await service
    .from("clients")
    .update(updates)
    .eq("id", parsed.clientId);

  if (error) {
    logServerError("cliente.chamada", error);
    return errorResponse("save-failed", 500, error);
  }

  return NextResponse.json({ ok: true });
}
