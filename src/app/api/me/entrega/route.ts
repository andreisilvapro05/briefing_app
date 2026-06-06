import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Cliente atualiza APENAS seus campos do DEP: domínio + hospedagem.
 * Não toca em nada que o admin preencheu.
 *
 * Aceita sem auth — clientId é UUID. Idem padrão de /api/me/stage.
 */

const Body = z.object({
  clientId: z.string().uuid(),
  clienteDominio: z.string().max(500).optional(),
  clienteHospedagem: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  try {
    const service = createSupabaseServiceRoleClient();
    // Carrega o doc atual pra preservar tudo + injeta apenas os 2 campos.
    const { data: cur } = await service
      .from("clients")
      .select("entrega_documento")
      .eq("id", parsed.clientId)
      .maybeSingle();

    if (!cur) return errorResponse("client-not-found", 404);

    const docAtual =
      (cur.entrega_documento as Record<string, unknown> | null) ?? {};

    const nowIso = new Date().toISOString();
    const novoDoc = {
      ...docAtual,
      clienteDominio: parsed.clienteDominio ?? docAtual.clienteDominio ?? "",
      clienteHospedagem:
        parsed.clienteHospedagem ?? docAtual.clienteHospedagem ?? "",
      clienteAtualizadoAt: nowIso,
    };

    const { error } = await service
      .from("clients")
      .update({
        entrega_documento: novoDoc,
        last_client_activity_at: nowIso,
      })
      .eq("id", parsed.clientId);

    if (error) {
      logServerError("me.entrega.update", error);
      return errorResponse("save-failed", 500, error);
    }

    return NextResponse.json({
      ok: true,
      clienteAtualizadoAt: nowIso,
    });
  } catch (err) {
    logServerError("me.entrega.unexpected", err);
    return errorResponse("internal", 500);
  }
}
