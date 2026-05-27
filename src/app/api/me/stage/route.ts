import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";

/**
 * Devolve o stage atual do projeto pra um cliente, dado o clientId
 * (que ele já tem em localStorage). Resposta minimalista — apenas
 * stage_index + status — pra alimentar o dashboard.
 *
 * Não é endpoint sensível: clientId é UUID (alta entropia) e a resposta
 * não inclui PII. Seguro pra ser chamado sem auth.
 */

const Body = z.object({
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ stageIndex: 0, status: "em-andamento" });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  try {
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from("clients")
      .select(
        "current_stage_index, status, project_type, contrato_preenchido_at, chamada_agendada_at, chamada_data, briefing_submitted_at, fysi_drive_link, copy_review_link, contrato_status, contrato_signed_url, pagamento_total, pagamento_pago, pagamento_observacao, pagamento_atualizado_at"
      )
      .eq("id", parsed.clientId)
      .maybeSingle();

    if (error) {
      logServerError("me.stage", error);
      return errorResponse("query-failed", 500, error);
    }

    if (!data) {
      return errorResponse("client-not-found", 404);
    }

    return NextResponse.json({
      stageIndex: data.current_stage_index ?? 0,
      status: data.status,
      projectType: data.project_type,
      contratoPreenchido: !!data.contrato_preenchido_at,
      chamadaAgendada: !!data.chamada_agendada_at,
      chamadaData: data.chamada_data,
      briefingSubmetido: !!data.briefing_submitted_at,
      fysiDriveLink: data.fysi_drive_link ?? null,
      copyReviewLink: data.copy_review_link ?? null,
      contratoStatus: data.contrato_status ?? null,
      contratoSignedUrl: data.contrato_signed_url ?? null,
      pagamentoTotal:
        data.pagamento_total != null ? Number(data.pagamento_total) : null,
      pagamentoPago:
        data.pagamento_pago != null ? Number(data.pagamento_pago) : 0,
      pagamentoObservacao: data.pagamento_observacao ?? null,
      pagamentoAtualizadoAt: data.pagamento_atualizado_at ?? null,
    });
  } catch (err) {
    logServerError("me.stage.unexpected", err);
    return errorResponse("internal", 500);
  }
}
