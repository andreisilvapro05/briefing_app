import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";
import { indiceNaLinhaDoTempo } from "@/lib/etapa-pelo-status";
import { buildTimeline } from "@/lib/project-types";
import { copyNoPainelDoCliente } from "@/lib/copy-server";
import type { ProjectType } from "@/lib/types";

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
        "current_stage_index, status, project_type, contrato_preenchido_at, chamada_agendada_at, chamada_data, briefing_submitted_at, fysi_drive_link, copy_review_link, contrato_status, contrato_signed_url, contrato_link_assinatura, pagamento_total, pagamento_pago, pagamento_observacao, pagamento_atualizado_at, entrega_documento, entrega_finalizada_at, arquivado_em"
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

    /**
     * A copy DENTRO do app, quando o link dela está ligado.
     *
     * Só depois de achar o cliente: uma consulta a mais em toda chamada
     * desta rota (o painel a chama em cada carregamento) não se paga pra
     * clientId inexistente.
     */
    const copyNoApp = await copyNoPainelDoCliente(parsed.clientId);

    return NextResponse.json({
      /**
       * A etapa que o cliente vê sai do STATUS do projeto, não de
       * `current_stage_index`.
       *
       * Eram três fontes independentes pra "onde o projeto está", e esta
       * rota lia a única que ninguém atualizava: um número que só muda se
       * alguém lembrar. A equipe movia o projeto no quadro todo dia e o
       * cliente seguia vendo "Onboarding". Agora mover no quadro move o
       * que ele vê — e o valor manual continua valendo como piso, pra o
       * app não desfazer um avanço feito à mão na frente do cliente.
       */
      stageIndex: indiceNaLinhaDoTempo(
        data.status as string | null,
        data.project_type
          ? buildTimeline(data.project_type as ProjectType, 0).map((e) => e.titulo)
          : [],
        Number(data.current_stage_index) || 0
      ),
      status: data.status,
      /**
       * Projeto ENCERRADO (o cliente desistiu e a equipe arquivou).
       *
       * Nenhum consumidor do lado do cliente olhava `arquivado_em`: quem
       * desistia continuava com o painel inteiro pedindo CNPJ pra Pix e
       * dizendo "faltam 3 itens pra gente seguir com o seu projeto". A
       * equipe arquivava justamente pra parar de tocar o projeto.
       */
      arquivado: Boolean(data.arquivado_em),
      projectType: data.project_type,
      contratoPreenchido: !!data.contrato_preenchido_at,
      chamadaAgendada: !!data.chamada_agendada_at,
      chamadaData: data.chamada_data,
      briefingSubmetido: !!data.briefing_submitted_at,
      fysiDriveLink: data.fysi_drive_link ?? null,
      /**
       * A copy do app GANHA do link do Drive quando existe e está ligada.
       *
       * O campo `copy_review_link` é de antes de a copy morar aqui
       * (30/09) e segue preenchido em dois clientes, porque os projetos em
       * andamento ainda apontam pra aquela pasta. Sem esta precedência,
       * ela escreveria a copy no app e o cliente continuaria sendo
       * mandado pro Drive.
       */
      copyReviewLink: copyNoApp?.caminho ?? data.copy_review_link ?? null,
      /** "aguardando" | "ajuste-pedido" | "aprovada" — null quando a copy não é do app. */
      copySituacao: copyNoApp?.situacao ?? null,
      contratoStatus: data.contrato_status ?? null,
      contratoSignedUrl: data.contrato_signed_url ?? null,
      contratoLinkAssinatura: data.contrato_link_assinatura ?? null,
      pagamentoTotal:
        data.pagamento_total != null ? Number(data.pagamento_total) : null,
      pagamentoPago:
        data.pagamento_pago != null ? Number(data.pagamento_pago) : 0,
      pagamentoObservacao: data.pagamento_observacao ?? null,
      pagamentoAtualizadoAt: data.pagamento_atualizado_at ?? null,
      entregaDocumento: data.entrega_documento ?? null,
      entregaFinalizadaAt: data.entrega_finalizada_at ?? null,
    });
  } catch (err) {
    logServerError("me.stage.unexpected", err);
    return errorResponse("internal", 500);
  }
}
