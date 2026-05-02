import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Salva uma resposta individual do briefing.
 * Em modo demo (sem auth) retorna 401 silenciosamente — o cliente faz
 * fallback para localStorage e segue funcionando.
 */

const Body = z.object({
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

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    // Supabase não configurado — modo demo.
    return NextResponse.json({ mode: "demo" }, { status: 401 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Resolve client_id pelo auth_user_id
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json(
      { error: "client-not-found" },
      { status: 404 }
    );
  }

  const fullKey = `${parsed.blocoId}.${parsed.fieldId}`;

  const { error } = await supabase
    .from("briefing_responses")
    .upsert(
      {
        client_id: client.id,
        bloco_id: parsed.blocoId,
        field_id: fullKey,
        value: parsed.value as never,
      },
      { onConflict: "client_id,field_id" }
    );

  if (error) {
    logServerError("briefing.save", error);
    return errorResponse("save-failed", 500, error);
  }

  // Toca last_client_activity_at pro indicador de "parado" no /admin.
  await supabase
    .from("clients")
    .update({ last_client_activity_at: new Date().toISOString() })
    .eq("id", client.id);

  return NextResponse.json({ ok: true });
}
