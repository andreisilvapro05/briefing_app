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

  const ok = await sendDashboardWebhook({
    event: "pagamento.atualizado",
    emittedAt: new Date().toISOString(),
    source: "briefing_app",
    clientId: "00000000-0000-0000-0000-000000000000",
    cliente: {
      id: "00000000-0000-0000-0000-000000000000",
      nome: "Cliente de Teste",
      email: "teste@fysilab.com",
      empresa: "Empresa Teste",
      whatsapp: "(11) 99999-9999",
      cpf: null,
      cnpj: null,
      razao_social: null,
      endereco: null,
      cep: null,
      project_type: "landing-com-copy",
    },
    pagamento: {
      total: 1800,
      pago: 900,
      pendente: 900,
      observacao: "Payload de teste — disparado manualmente pelo admin.",
    },
  });

  return NextResponse.json({
    ok,
    target: env.dashboardWebhookUrl,
    hasSecret: !!env.dashboardWebhookSecret,
  });
}
