import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * Verifica um link de acesso gerado pelo servidor (admin.generateLink) via
 * token_hash — SEM PKCE, então funciona em qualquer aparelho/navegador
 * (diferente do /auth/callback que troca `code` e depende do code_verifier
 * do mesmo browser). Usado pelos "links de acesso copiáveis" da tela de
 * Membros, pra onboardar a equipe por WhatsApp sem depender do e-mail.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const nextRaw = searchParams.get("next") ?? "/admin";
  // Só caminho relativo interno — nunca redirecionar pra fora do app.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/admin";

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/auth/erro?reason=missing-token`);
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.redirect(`${origin}/auth/erro?reason=config`);
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/erro?reason=${encodeURIComponent(error.message)}`
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (user?.email) {
    // Mesma ligação de auth_user_id do /auth/callback — membro E cliente,
    // pra rota servir os dois tipos de link de acesso.
    const service = createSupabaseServiceRoleClient();
    await service
      .from("clients")
      .update({
        auth_user_id: user.id,
        email_verified_at: new Date().toISOString(),
      })
      .eq("email", user.email)
      .is("auth_user_id", null);
    await service
      .from("team_members")
      .update({ auth_user_id: user.id, last_login_at: new Date().toISOString() })
      .eq("email", user.email.toLowerCase())
      .is("auth_user_id", null);
    await service
      .from("team_members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("auth_user_id", user.id);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
