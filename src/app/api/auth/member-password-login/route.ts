import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Login individual por e-mail + senha (Caixa 0). Alternativa ao magic link
 * que não depende de e-mail chegar. A senha é do Supabase Auth (por pessoa),
 * NÃO a senha compartilhada legada (essa é /api/auth/admin-password).
 *
 * Resposta 401 é genérica de propósito — não diferencia "senha errada" de
 * "não é membro", pra não vazar quem faz parte da equipe.
 */

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const email = parsed.email.toLowerCase();

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return errorResponse("server-not-configured", 503);
  }

  const { data: signIn, error: signInErr } =
    await supabase.auth.signInWithPassword({
      email,
      password: parsed.password,
    });

  if (signInErr || !signIn.user) {
    return errorResponse("invalid-credentials", 401);
  }

  const service = createSupabaseServiceRoleClient();
  const { data: member } = await service
    .from("team_members")
    .select("id")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (!member) {
    // Conta de auth válida mas não é membro ativo da equipe — desfaz a
    // sessão que o signIn criou e devolve o MESMO 401 genérico.
    await supabase.auth.signOut();
    return errorResponse("invalid-credentials", 401);
  }

  try {
    await service
      .from("team_members")
      .update({
        auth_user_id: signIn.user.id,
        last_login_at: new Date().toISOString(),
      })
      .eq("email", email)
      .is("auth_user_id", null);
    await service
      .from("team_members")
      .update({ last_login_at: new Date().toISOString() })
      .eq("auth_user_id", signIn.user.id);
  } catch (err) {
    // Vínculo é best-effort — o login em si já deu certo.
    logServerError("auth.member-password.link", err);
  }

  return NextResponse.json({ ok: true });
}
