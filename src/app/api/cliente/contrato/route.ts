import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";

/**
 * Salva os dados de contrato do cliente.
 *
 * Inclui email e empresa (movidos da Tela 1 pra cá — UX mais leve no início).
 * Após salvar, dispara magic link via Supabase Auth pra que o cliente
 * possa retomar a sessão de outro dispositivo.
 */

const Body = z.object({
  clientId: z.string().uuid(),
  // Movidos da Tela 1 pra cá:
  email: z.string().email(),
  empresa: z.string().min(1),
  // Dados específicos do contrato:
  endereco: z.string().min(1),
  cep: z.string().min(1),
  cpf: z.string().min(1),
  como_conheceu: z.string().min(1),
  rg: z.string().optional(),
  cnpj: z.string().optional(),
  razao_social: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return NextResponse.json({ mode: "demo", ok: true });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const service = createSupabaseServiceRoleClient();

  const { data: existing } = await service
    .from("clients")
    .select("id, email")
    .eq("id", parsed.clientId)
    .maybeSingle();
  if (!existing) return errorResponse("client-not-found", 404);

  const emailWasEmpty = !existing.email;

  const { error } = await service
    .from("clients")
    .update({
      email: parsed.email,
      empresa: parsed.empresa,
      endereco: parsed.endereco,
      cep: parsed.cep,
      cpf: parsed.cpf,
      como_conheceu: parsed.como_conheceu,
      rg: parsed.rg ?? null,
      cnpj: parsed.cnpj ?? null,
      razao_social: parsed.razao_social ?? null,
      contrato_preenchido_at: new Date().toISOString(),
      last_client_activity_at: new Date().toISOString(),
    })
    .eq("id", parsed.clientId);

  if (error) {
    logServerError("cliente.contrato", error);
    return errorResponse("save-failed", 500, error);
  }

  // Se o cliente não tinha email antes, dispara o magic link agora.
  // Cliente vai poder usar o link pra retomar de outro dispositivo.
  if (emailWasEmpty) {
    try {
      await service.auth.signInWithOtp({
        email: parsed.email,
        options: {
          emailRedirectTo: `${env.appUrl}/auth/callback`,
          shouldCreateUser: true,
          data: {
            client_id: parsed.clientId,
            nome: parsed.empresa,
          },
        },
      });
    } catch (err) {
      logServerError("cliente.contrato.otp", err);
      // Não bloqueia o save — só falha o magic link.
    }
  }

  return NextResponse.json({ ok: true });
}
