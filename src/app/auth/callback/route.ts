import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * Callback do magic link. Supabase redireciona pra cá com `code` na query.
 * Trocamos `code` por sessão (cookies) e ligamos auth_user_id ao cliente
 * pré-existente (criado em /api/auth/start).
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/erro`);
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.redirect(`${origin}/auth/erro?reason=config`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/erro?reason=${encodeURIComponent(error.message)}`
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (user && user.email) {
    // Liga auth_user_id ao registro de cliente do mesmo e-mail
    const service = createSupabaseServiceRoleClient();
    await service
      .from("clients")
      .update({
        auth_user_id: user.id,
        email_verified_at: new Date().toISOString(),
      })
      .eq("email", user.email)
      .is("auth_user_id", null);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
