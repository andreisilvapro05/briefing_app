import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";

/**
 * Persiste o tipo de projeto escolhido pelo cliente na tela /projeto.
 *
 * O cliente já tem registro no banco (criado em /api/auth/start). Sem essa
 * chamada, o tipo ficaria só no localStorage e o admin veria "vazio" até o
 * envio do briefing — que era o bug de "o tipo escolhido não aparece".
 *
 * Segue o mesmo padrão de /api/cliente/chamada: identifica por clientId
 * (sem sessão) e é best-effort no client (não bloqueia a navegação).
 */

const Body = z.object({
  clientId: z.string().uuid(),
  projectType: z.enum([
    "landing-com-copy",
    "landing-sem-copy",
    "site-completo",
    "seo",
    "outro",
  ]),
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

  const { error } = await service
    .from("clients")
    .update({
      project_type: parsed.projectType,
      last_client_activity_at: new Date().toISOString(),
    })
    .eq("id", parsed.clientId);

  if (error) {
    logServerError("cliente.project-type", error);
    return errorResponse("save-failed", 500, error);
  }

  return NextResponse.json({ ok: true });
}
