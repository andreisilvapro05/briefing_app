import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Reenvia magic link para um e-mail existente.
 * Usado tanto pela tela /entrar quanto pelo painel admin.
 *
 * Sempre retorna 200 mesmo quando o e-mail não existe — pra não vazar
 * lista de clientes via timing/respostas diferentes.
 */

const Body = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return NextResponse.json({ mode: "demo", ok: true });
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.auth.signInWithOtp({
    email: parsed.email,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    logServerError("auth.resend", error);
    // Mesmo em erro, devolvemos sucesso silencioso pra não enumerar contas.
  }

  return NextResponse.json({ ok: true });
}
