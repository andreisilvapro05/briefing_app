import { createHmac } from "node:crypto";
import { getServerEnv } from "./env";

/**
 * Webhook outbound pro dashboard financeiro da Fysi.
 *
 * Envia eventos (cliente criado, contrato assinado, pagamento atualizado) via
 * POST com payload JSON e header `X-Fysi-Signature` contendo HMAC-SHA256 do
 * corpo da requisição assinado com DASHBOARD_WEBHOOK_SECRET. O dashboard
 * receptor valida a assinatura antes de processar.
 *
 * Comportamento offline-safe:
 *  - sem URL configurada → no-op silencioso
 *  - falha de rede / 4xx / 5xx → log no console mas NÃO propaga erro (não
 *    bloqueia a operação principal)
 */

export type DashboardEvent =
  | "cliente.criado"
  | "cliente.atualizado"
  | "contrato.assinado"
  | "pagamento.atualizado"
  | "cobranca.paga";

interface BasePayload {
  event: DashboardEvent;
  // ISO 8601
  emittedAt: string;
  // ID do cliente no briefing_app (UUID)
  clientId: string;
  // Pra rastreabilidade: app que disparou
  source: "briefing_app";
}

interface ClientePayload extends BasePayload {
  cliente: {
    id: string;
    nome: string | null;
    email: string | null;
    empresa: string | null;
    whatsapp: string | null;
    cpf: string | null;
    cnpj: string | null;
    razao_social: string | null;
    endereco: string | null;
    cep: string | null;
    project_type: string | null;
  };
}

interface ContratoAssinadoPayload extends ClientePayload {
  event: "contrato.assinado";
  contrato: {
    autentique_document_id: string | null;
    signed_url: string | null;
    pacote_nome: string | null;
    valor_parcelamento: string | null;
    prazo_execucao: string | null;
    escopo_projeto: string | null;
    link_parcelamento: string | null;
  };
}

interface PagamentoAtualizadoPayload extends ClientePayload {
  event: "pagamento.atualizado";
  pagamento: {
    total: number | null;
    pago: number;
    pendente: number;
    observacao: string | null;
  };
}

/**
 * Cobrança paga — mensal OU pontual. Não exige clientId do briefing_app
 * (pode ser cobrança externa). Usa cobrancaId como chave principal.
 */
export interface CobrancaPagaPayload extends BasePayload {
  event: "cobranca.paga";
  cobrancaId: string;
  cobranca: {
    tipo: "mensal" | "pontual";
    nome: string;
    empresa: string | null;
    whatsapp: string | null;
    email: string | null;
    descricao: string | null;
    valor: number;
    mesReferencia: string;
    pagoEm: string;
    forma: string;
    observacao: string;
  };
}

export type WebhookPayload =
  | ClientePayload
  | ContratoAssinadoPayload
  | PagamentoAtualizadoPayload
  | CobrancaPagaPayload;

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Dispara o webhook. Não joga erro — só loga e segue.
 * Retorna true se enviou (200-299), false se falhou ou estava desativado.
 */
export async function sendDashboardWebhook(
  payload: WebhookPayload
): Promise<boolean> {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return false;
  }

  if (!env.dashboardWebhookUrl) {
    // Desativado silenciosamente — env var não configurada.
    return false;
  }

  const body = JSON.stringify(payload);
  const signature = env.dashboardWebhookSecret
    ? signBody(body, env.dashboardWebhookSecret)
    : "";

  try {
    // 8s de timeout — webhook não pode segurar a operação principal.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(env.dashboardWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fysi-Event": payload.event,
        "X-Fysi-Signature": signature,
      },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(
        `[dashboard-webhook] ${payload.event} → ${res.status} ${res.statusText}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      `[dashboard-webhook] ${payload.event} falhou:`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Helper: monta o sub-payload de cliente a partir do row do Supabase.
 */
export function buildClientePayload(row: {
  id: string;
  nome: string | null;
  email: string | null;
  empresa: string | null;
  whatsapp: string | null;
  cpf: string | null;
  cnpj: string | null;
  razao_social: string | null;
  endereco: string | null;
  cep: string | null;
  project_type: string | null;
}): ClientePayload["cliente"] {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    empresa: row.empresa,
    whatsapp: row.whatsapp,
    cpf: row.cpf,
    cnpj: row.cnpj,
    razao_social: row.razao_social,
    endereco: row.endereco,
    cep: row.cep,
    project_type: row.project_type,
  };
}
