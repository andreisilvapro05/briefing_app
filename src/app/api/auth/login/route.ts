import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Login do cliente por telefone (WhatsApp) + código de acesso global.
 *
 * O código é o mesmo pra todos os clientes (env CLIENT_ACCESS_CODE) — funciona
 * como uma trava leve. O WhatsApp identifica qual briefing abrir.
 *
 * Em sucesso devolve o registro do cliente; a tela /entrar grava no
 * localStorage e leva pro painel. Permite reentrar de qualquer aparelho
 * e que outra pessoa (sócio) acesse o mesmo briefing.
 */

const Body = z.object({
  whatsapp: z.string().min(8),
  code: z.string().min(1).max(100),
});

/** Comparação time-constant pra não vazar o código via timing. */
function codeMatches(submitted: string, expected: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(b, b); // comparação falsa pra manter timing constante
    return false;
  }
  return timingSafeEqual(a, b);
}

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
    // Supabase não configurado — não há banco pra consultar.
    return errorResponse("not-configured", 503);
  }

  // Valida o código global. Delay anti brute-force trivial.
  if (!codeMatches(parsed.code.trim(), env.clientAccessCode)) {
    await new Promise((r) => setTimeout(r, 600));
    return errorResponse("invalid-code", 401);
  }

  const digits = parsed.whatsapp.replace(/\D/g, "");
  if (digits.length < 8) {
    return errorResponse("payload-invalid", 400);
  }

  let found: {
    id: string;
    nome: string;
    email: string | null;
    empresa: string | null;
    whatsapp: string;
    project_type: string | null;
  } | null = null;

  try {
    const service = createSupabaseServiceRoleClient();
    // Busca por WhatsApp normalizado (só dígitos) — cobre registros com
    // formatações diferentes. Mais recente primeiro.
    const { data, error } = await service
      .from("clients")
      .select("id, nome, email, empresa, whatsapp, project_type")
      .order("created_at", { ascending: false });
    if (error) {
      logServerError("auth.login", error);
      return errorResponse("query-failed", 500, error);
    }
    found =
      (data ?? []).find(
        (c) => (c.whatsapp ?? "").replace(/\D/g, "") === digits
      ) ?? null;
  } catch (err) {
    logServerError("auth.login.unexpected", err);
    return errorResponse("internal", 500);
  }

  if (!found) {
    // Delay leve pra não diferenciar "telefone não existe" de "código errado".
    await new Promise((r) => setTimeout(r, 400));
    return errorResponse("not-found", 404);
  }

  return NextResponse.json({
    id: found.id,
    nome: found.nome,
    email: found.email ?? undefined,
    empresa: found.empresa ?? undefined,
    whatsapp: found.whatsapp,
    projectType: found.project_type ?? undefined,
  });
}
