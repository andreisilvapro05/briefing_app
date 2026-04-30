import { createSupabaseServerClient } from "./supabase/server";
import { getServerEnv } from "./env";

/**
 * Resolve o usuário logado e verifica se ele é um admin (ADMIN_EMAILS).
 * Retorna null se não autenticado ou se o e-mail não está na allowlist.
 */
export async function getAdminUser() {
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

  return user;
}
