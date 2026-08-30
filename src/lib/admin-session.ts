import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServerEnv } from "./env";

/**
 * Sessão admin via cookie assinado.
 *
 * Estratégia: HMAC-SHA256 do segredo (derivado do SUPABASE_SERVICE_ROLE_KEY,
 * que já é secreto e disponível server-side). Cookie HttpOnly + Secure +
 * SameSite=Lax. Validade de 30 dias.
 *
 * Não armazena nada no banco — totalmente stateless. Pra "deslogar"
 * basta limpar o cookie.
 */

export const ADMIN_SESSION_COOKIE_NAME = "fysi-admin";
const COOKIE_NAME = ADMIN_SESSION_COOKIE_NAME;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function sessionToken(): string {
  const env = getServerEnv();
  // Deriva um token determinístico do segredo do servidor.
  // Mesmo se ADMIN_PASSWORD mudar, sessões antigas continuam válidas até
  // SUPABASE_SERVICE_ROLE_KEY mudar.
  return createHmac("sha256", env.serviceRoleKey)
    .update(`admin-session:v1`)
    .digest("hex");
}

/**
 * Opções do cookie de sessão (nome, token HMAC, flags) — exportado pra
 * `src/proxy.ts` também poder setar esse MESMO cookie via a API de
 * `NextResponse.cookies` (diferente da `cookies()` de next/headers usada
 * aqui), sem duplicar a lógica do token nem arriscar os dois lugares
 * divergirem se a config mudar.
 */
export function adminSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: sessionToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function setAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookieOptions());
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Retorna true se o cookie de sessão atual é válido.
 */
export async function hasValidAdminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return false;

    const expected = sessionToken();
    if (cookie.value.length !== expected.length) return false;

    return timingSafeEqual(
      Buffer.from(cookie.value, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Valida senha submetida contra ADMIN_PASSWORD em time-constant.
 */
export function isPasswordValid(submitted: string): boolean {
  try {
    const env = getServerEnv();
    const expected = env.adminPassword;
    if (!expected) return false;

    // Pad pra evitar leak de tamanho via timing
    const a = Buffer.from(submitted, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) {
      // Fake comparison pra manter timing constante
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
