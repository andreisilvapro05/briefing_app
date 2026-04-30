import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Lê/escreve cookies HTTP para manter a sessão.
 */
export async function createSupabaseServerClient() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll pode falhar quando chamado a partir de um Server Component
          // — silenciar é seguro porque o middleware refresh-a a sessão.
        }
      },
    },
  });
}

/**
 * Cliente service-role (bypass RLS).
 * Usar APENAS em rotas de servidor confiáveis: criação de cliente sem auth,
 * envio de e-mail magic-link, integrações ClickUp etc.
 */
export function createSupabaseServiceRoleClient() {
  const env = getServerEnv();
  // Service role usa @supabase/supabase-js direto (não precisa de cookies).
  // Usamos createServerClient com noOp cookies para reaproveitar tipagens.
  return createServerClient(env.supabaseUrl, env.serviceRoleKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
