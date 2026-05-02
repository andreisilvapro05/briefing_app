import { createSupabaseServerClient } from "./supabase/server";
import { getServerEnv } from "./env";
import { hasValidAdminSession } from "./admin-session";

/**
 * Identifica se a request é de um admin autenticado.
 * Retorna `null` se não for admin.
 *
 * Aceita 2 formas de autenticação (em ordem de preferência):
 * 1. Cookie `fysi-admin` (sessão por senha — mais comum hoje)
 * 2. Sessão Supabase Auth com e-mail na allowlist `ADMIN_EMAILS` (legado)
 */
export async function getAdminUser(): Promise<{
  email: string;
  source: "password" | "supabase";
} | null> {
  // Caminho 1: cookie de sessão admin (login por senha).
  if (await hasValidAdminSession()) {
    return { email: "admin@fysilab", source: "password" };
  }

  // Caminho 2: Supabase Auth + allowlist (compatibilidade com magic link).
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return null;
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !user.email) return null;

  const email = user.email.toLowerCase();
  if (!env.adminEmails.includes(email)) return null;

  return { email, source: "supabase" };
}
