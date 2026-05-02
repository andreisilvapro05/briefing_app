import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";

/**
 * Salva os dados de contrato do cliente (rua, CEP, CPF, CNPJ etc.).
 *
 * Aceita clientId no body — não exige sessão Supabase, igual ao
 * /api/upload e /api/auth/start. O clientId é UUID criado por
 * /api/auth/start e armazenado em localStorage.
 */

const Body = z.object({
  clientId: z.string().uuid(),
  // Todos opcionais individualmente — backend valida só os obrigatórios
  // declarados pela UI, pra ser flexível com futuros ajustes.
  endereco: z.string().optional(),
  cep: z.string().optional(),
  rg: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  razao_social: z.string().optional(),
  como_conheceu: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    getServerEnv();
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

  // Confirma que o cliente existe antes de gravar
  const { data: existing } = await service
    .from("clients")
    .select("id")
    .eq("id", parsed.clientId)
    .maybeSingle();
  if (!existing) return errorResponse("client-not-found", 404);

  const { error } = await service
    .from("clients")
    .update({
      endereco: parsed.endereco ?? null,
      cep: parsed.cep ?? null,
      rg: parsed.rg ?? null,
      cpf: parsed.cpf ?? null,
      cnpj: parsed.cnpj ?? null,
      razao_social: parsed.razao_social ?? null,
      como_conheceu: parsed.como_conheceu ?? null,
      contrato_preenchido_at: new Date().toISOString(),
      last_client_activity_at: new Date().toISOString(),
    })
    .eq("id", parsed.clientId);

  if (error) {
    logServerError("cliente.contrato", error);
    return errorResponse("save-failed", 500, error);
  }

  return NextResponse.json({ ok: true });
}
