import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Salva uma resposta individual do briefing.
 *
 * Identifica o cliente pelo `clientId` (UUID da tabela clients que o cliente
 * já tem em localStorage, vindo de /api/auth/start ou /api/auth/login). Grava
 * via service role — não depende de sessão Supabase Auth.
 *
 * Em modo demo (sem Supabase) responde { mode: "demo" } com 200 — o cliente
 * mantém tudo em localStorage e o fluxo segue.
 */

const Body = z.object({
  clientId: z.string().uuid(),
  blocoId: z.string().min(1),
  fieldId: z.string().min(1),
  value: z.unknown(),
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
    // Supabase não configurado — modo demo. localStorage já guardou.
    return NextResponse.json({ mode: "demo", ok: true });
  }

  const fullKey = `${parsed.blocoId}.${parsed.fieldId}`;

  const { error } = await service.from("briefing_responses").upsert(
    {
      client_id: parsed.clientId,
      bloco_id: parsed.blocoId,
      field_id: fullKey,
      value: parsed.value as never,
    },
    { onConflict: "client_id,field_id" }
  );

  if (error) {
    // 23503 = foreign key violation — o clientId não existe na tabela clients
    // (ex.: criação do cliente falhou antes). Não é erro fatal: o localStorage
    // do cliente continua intacto. Responde ok com persisted:false.
    if ((error as { code?: string }).code === "23503") {
      return NextResponse.json({ ok: true, persisted: false });
    }
    logServerError("briefing.save", error);
    return errorResponse("save-failed", 500, error);
  }

  // Toca last_client_activity_at pro indicador de "parado" no /admin.
  await service
    .from("clients")
    .update({ last_client_activity_at: new Date().toISOString() })
    .eq("id", parsed.clientId);

  return NextResponse.json({ ok: true, persisted: true });
}
