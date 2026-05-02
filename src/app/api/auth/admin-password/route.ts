import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import {
  isPasswordValid,
  setAdminSessionCookie,
} from "@/lib/admin-session";

/**
 * Login admin via senha compartilhada.
 *
 * - Valida a senha contra ADMIN_PASSWORD em time-constant.
 * - Se OK, seta cookie HttpOnly de sessão (30 dias).
 * - Resposta sempre genérica em caso de erro pra não vazar timing.
 */

const Body = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  if (!isPasswordValid(parsed.password)) {
    // Pequeno delay pra reduzir vantagem de brute-force trivial
    await new Promise((r) => setTimeout(r, 600));
    return errorResponse("invalid-credentials", 401);
  }

  try {
    await setAdminSessionCookie();
  } catch (err) {
    logServerError("auth.admin-password.cookie", err);
    return errorResponse("session-failed", 500);
  }

  return NextResponse.json({ ok: true });
}
