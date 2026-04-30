import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";

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
  if (!env.adminEmails.includes(email)) {
    // Resposta genérica pra não vazar quem é admin
    return NextResponse.json({ ok: true });
  }

  const service = createSupabaseServiceRoleClient();
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
    logServerError("auth.admin-login", error);
    return errorResponse("otp-failed", 500, error);
  }

  return NextResponse.json({ ok: true });
}
