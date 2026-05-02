import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-session";

/**
 * Limpa o cookie de sessão admin. Aceita GET pra facilitar link no header
 * (apenas idempotente) e POST pra forms tradicionais.
 */

async function logout() {
  await clearAdminSessionCookie();
  // 303 force GET no redirect — evita re-submit
  return NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    { status: 303 }
  );
}

export async function GET() {
  return logout();
}

export async function POST() {
  return logout();
}
