import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, isProduction, logServerError } from "@/lib/api-helpers";

/**
 * Cria/atualiza um registro de cliente e dispara o magic link de retomada.
 * Chamado pela Tela 1 (Identificação) após o cliente preencher os dados.
 *
 * Modo demo: se Supabase não estiver configurado, retorna `{ mode: "demo" }`
 * sem erro — Tela 1 continua o fluxo normalmente.
 */

const Body = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  empresa: z.string().min(1),
  whatsapp: z.string().min(8),
  // Identificadores anti-spam:
  // - turnstileToken: opcional (legado, manter pra quando Turnstile estiver ativo)
  // - hp: campo honeypot — humanos deixam vazio, bots preenchem
  // - elapsedMs: tempo entre abrir a tela e submeter — bots submetem em <2s
  turnstileToken: z.string().optional(),
  hp: z.string().optional(),
  elapsedMs: z.number().optional(),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return NextResponse.json({ mode: "demo" }, { status: 200 });
  }

  // Honeypot anti-spam: campo invisível que humanos não preenchem.
  if (parsed.hp && parsed.hp.trim().length > 0) {
    logServerError(
      "auth.start.honeypot",
      new Error("honeypot triggered")
    );
    // Resposta genérica fingindo sucesso — não dá feedback ao bot.
    return NextResponse.json({ ok: true });
  }

  // Timing check: form preenchido em <2s = provavelmente bot.
  if (
    typeof parsed.elapsedMs === "number" &&
    parsed.elapsedMs > 0 &&
    parsed.elapsedMs < 2000
  ) {
    logServerError(
      "auth.start.timing",
      new Error(`form too fast (${parsed.elapsedMs}ms)`)
    );
    return NextResponse.json({ ok: true });
  }

  // Captcha — obrigatório em produção (anti-spam de criação de clientes
  // e flood de magic-links). BYPASS_CAPTCHA=true desabilita; honeypot acima
  // já dá proteção razoável pra apps de baixo volume.
  if (isProduction() && !env.bypassCaptcha) {
    if (!env.turnstileSecret) {
      logServerError(
        "auth.start",
        new Error("TURNSTILE_SECRET_KEY ausente em produção")
      );
      return errorResponse("captcha-not-configured", 503);
    }
    if (!parsed.turnstileToken) {
      return errorResponse("captcha-required", 400);
    }
    const ok = await verifyTurnstile(env.turnstileSecret, parsed.turnstileToken);
    if (!ok) return errorResponse("captcha-failed", 400);
  } else if (env.turnstileSecret && parsed.turnstileToken) {
    const ok = await verifyTurnstile(env.turnstileSecret, parsed.turnstileToken);
    if (!ok) return errorResponse("captcha-failed", 400);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    null;
  const ua = request.headers.get("user-agent") ?? null;

  const service = createSupabaseServiceRoleClient();

  // Upsert por email (não usamos auth_user_id ainda — vem no callback do magic-link)
  const { data: existing } = await service
    .from("clients")
    .select("id")
    .eq("email", parsed.email)
    .maybeSingle();

  let clientId: string;
  if (existing) {
    clientId = existing.id;
    await service
      .from("clients")
      .update({
        nome: parsed.nome,
        empresa: parsed.empresa,
        whatsapp: parsed.whatsapp,
        ip_address: ip as never,
        user_agent: ua,
      })
      .eq("id", clientId);
  } else {
    const { data, error } = await service
      .from("clients")
      .insert({
        nome: parsed.nome,
        email: parsed.email,
        empresa: parsed.empresa,
        whatsapp: parsed.whatsapp,
        status: "em-andamento",
        ip_address: ip as never,
        user_agent: ua,
      })
      .select("id")
      .single();
    if (error) {
      logServerError("auth.start.create", error);
      return errorResponse("create-failed", 500, error);
    }
    clientId = data.id;
  }

  // Dispara magic link via Supabase Auth (signInWithOtp)
  const { error: authErr } = await service.auth.signInWithOtp({
    email: parsed.email,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback`,
      shouldCreateUser: true,
      data: {
        client_id: clientId,
        nome: parsed.nome,
        empresa: parsed.empresa,
      },
    },
  });

  if (authErr) {
    logServerError("auth.start.otp", authErr);
    return errorResponse("otp-failed", 500, authErr);
  }

  return NextResponse.json({ clientId, ok: true });
}

async function verifyTurnstile(secret: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
