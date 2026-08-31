import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Login por pessoa (Caixa 0) — evolução de /api/auth/admin-login: valida o
 * e-mail contra `team_members(active)` em vez da allowlist estática
 * `ADMIN_EMAILS`, e marca `invited_at` na primeira vez.
 */

const Body = z.object({ email: z.string().email() });

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
    return errorResponse("server-not-configured", 503);
  }

  const email = parsed.email.toLowerCase();
  const service = createSupabaseServiceRoleClient();

  const { data: member } = await service
    .from("team_members")
    .select("id, invited_at")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (!member) {
    // Resposta genérica pra não vazar quem é membro da equipe.
    return NextResponse.json({ ok: true });
  }

  const { error } = await service.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent(
        "/admin"
      )}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    logServerError("auth.member-login", error);
    return errorResponse("otp-failed", 500, error);
  }

  if (!(member as { invited_at: string | null }).invited_at) {
    await service
      .from("team_members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", (member as { id: string }).id);
  }

  return NextResponse.json({ ok: true });
}
