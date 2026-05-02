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

const COOKIE_NAME = "fysi-admin";
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

export async function setAdminSessionCookie() {
  const token = sessionToken();
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
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
