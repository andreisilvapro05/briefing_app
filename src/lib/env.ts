/**
 * Validação leve das envs em runtime.
 * Não usa zod aqui pra manter o módulo zero-side-effect e barato em edge.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Variável de ambiente "${name}" não definida. Verifique seu .env.local.`
    );
  }
  return value;
}

export const env = {
  // Públicas — disponíveis no client
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  storageBucket:
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "briefing-uploads",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
};

/** Server-only — falha se acessado do client. */
export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv só pode ser chamado em runtime de servidor.");
  }
  return {
    supabaseUrl: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    supabaseAnonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    serviceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    openaiKey: process.env.OPENAI_API_KEY ?? "",
    openaiTranscribeModel:
      process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1",
    resendKey: process.env.RESEND_API_KEY ?? "",
    resendFromEmail:
      process.env.RESEND_FROM_EMAIL ?? "Fysi Lab <onboarding@fysilab.com>",
    teamEmail: process.env.TEAM_EMAIL ?? "fysilabdigital@gmail.com",
    clickupToken: process.env.CLICKUP_API_TOKEN ?? "",
    clickupListId: process.env.CLICKUP_LIST_ID ?? "",
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? "",
    // Bypass do gate de captcha em produção quando Turnstile ainda não está
    // configurado. Use BYPASS_CAPTCHA=true no Vercel pra liberar o app
    // enquanto aguarda Cloudflare. NÃO use em produção real com tráfego.
    bypassCaptcha:
      (process.env.BYPASS_CAPTCHA ?? "").toLowerCase() === "true",
    // Senha compartilhada do painel admin. Default fysi-2026 só pra dev —
    // SEMPRE setar via env em produção (e remover esse default).
    adminPassword: process.env.ADMIN_PASSWORD ?? "fysi-2026",
    // Código de acesso global do cliente (telefone + código pra reentrar no
    // briefing de qualquer aparelho). Default só pra dev — SEMPRE setar
    // CLIENT_ACCESS_CODE via env em produção.
    clientAccessCode: process.env.CLIENT_ACCESS_CODE ?? "fysi",
    // Autentique — token Bearer da API (Conta → Integrações → API no painel).
    // Sem isso, /api/admin/contracts/send retorna 503 e o admin vê aviso.
    autentiqueToken: process.env.AUTENTIQUE_API_TOKEN ?? "",
    adminEmails: (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    storageBucket:
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "briefing-uploads",
  };
}
