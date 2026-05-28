import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { errorResponse } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";
import { sendDashboardWebhook } from "@/lib/dashboard-webhook";

/**
 * Dispara um webhook de teste pro dashboard financeiro.
 * Útil pra validar a integração sem precisar gerar um pagamento real.
 *
 * GET /api/admin/webhook/test?key=<admin-key>
 */

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const admin = await getAdminUser({ urlKey: url.searchParams.get("key") });
  if (!admin) return errorResponse("unauthenticated", 401);

  let env;
  try {
    env = getServerEnv();
  } catch {
    return errorResponse("env-missing", 500);
  }

  if (!env.dashboardWebhookUrl) {
    return NextResponse.json({
      ok: false,
      reason: "DASHBOARD_WEBHOOK_URL não configurado nas envs",
    });
  }

  const action = url.searchParams.get("action") ?? "pagamento";
  const testClientId = "11111111-1111-1111-1111-111111111111";

  const cliente = {
    id: testClientId,
    nome: "Cliente de Teste E2E",
    email: "teste@fysilab.com",
    empresa: "Empresa Teste E2E",
    whatsapp: "(11) 99999-9999",
    cpf: null,
    cnpj: null,
    razao_social: null,
    endereco: null,
    cep: null,
    project_type: "landing-com-copy",
  };

  if (action === "contrato") {
    const ok = await sendDashboardWebhook({
      event: "contrato.assinado",
      emittedAt: new Date().toISOString(),
      source: "briefing_app",
      clientId: testClientId,
      cliente,
      contrato: {
        autentique_document_id: null,
        signed_url: null,
        pacote_nome: "Pacote Teste",
        valor_parcelamento: "R$1.800,00 à vista ou 7x de R$260",
        prazo_execucao: "6 dias úteis",
        escopo_projeto: "Payload de teste — contrato.assinado E2E",
        link_parcelamento: null,
      },
    });
    return NextResponse.json({
      ok,
      event: "contrato.assinado",
      target: env.dashboardWebhookUrl,
      hasSecret: !!env.dashboardWebhookSecret,
    });
  }

  const ok = await sendDashboardWebhook({
    event: "pagamento.atualizado",
    emittedAt: new Date().toISOString(),
    source: "briefing_app",
    clientId: testClientId,
    cliente,
    pagamento: {
      total: 1800,
      pago: 900,
      pendente: 900,
      observacao: "Payload de teste — pagamento.atualizado E2E.",
    },
  });

  return NextResponse.json({
    ok,
    event: "pagamento.atualizado",
    target: env.dashboardWebhookUrl,
    hasSecret: !!env.dashboardWebhookSecret,
  });
}
