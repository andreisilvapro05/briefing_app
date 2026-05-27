import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import type { DashboardEvent } from "@/lib/dashboard-webhook";

/**
 * Receiver do webhook outbound do próprio briefing_app.
 *
 * Recebe POST com body JSON, valida HMAC-SHA256 via X-Fysi-Signature usando
 * DASHBOARD_WEBHOOK_SECRET, e processa os 3 eventos (cliente.criado,
 * contrato.assinado, pagamento.atualizado).
 *
 * Por enquanto só loga — a persistência (tabela dashboard_events, dashboard
 * UI) é fase seguinte.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_EVENTS: ReadonlyArray<DashboardEvent> = [
  "cliente.criado",
  "cliente.atualizado",
  "contrato.assinado",
  "pagamento.atualizado",
];

function verifySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (err) {
    logServerError("fysi-webhook:env", err);
    return errorResponse("env-missing", 500);
  }

  if (!env.dashboardWebhookSecret) {
    return errorResponse("secret-missing", 500);
  }

  // Body precisa ser raw pra validar o HMAC com os bytes exatos que o sender
  // assinou. JSON.parse depois reusa essa string.
  const rawBody = await request.text();
  const signature = request.headers.get("x-fysi-signature") ?? "";
  if (!signature) {
    return errorResponse("missing-signature", 401);
  }

  if (!verifySignature(rawBody, signature, env.dashboardWebhookSecret)) {
    return errorResponse("invalid-signature", 401);
  }

  let payload: { event?: string; clientId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse("invalid-json", 400);
  }

  const eventHeader = request.headers.get("x-fysi-event") ?? "";
  const event = (payload.event ?? eventHeader) as DashboardEvent;

  if (!KNOWN_EVENTS.includes(event)) {
    console.warn(`[fysi-webhook] evento desconhecido: ${event}`);
    return NextResponse.json(
      { ok: false, reason: "unknown-event" },
      { status: 422 },
    );
  }

  // Log estruturado — fácil de filtrar nos logs da Vercel.
  console.log(
    `[fysi-webhook] ${event} clientId=${payload.clientId ?? "?"} bytes=${rawBody.length}`,
  );

  // TODO(fase 2): persistir em tabela `dashboard_events` no Supabase e
  // alimentar a view do dashboard interno. Por enquanto só ACK.

  return NextResponse.json({ ok: true, event });
}

// GET pra health-check rápido (sem expor segredo) — confirma só que a
// rota existe e qual o conjunto de eventos esperados.
export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "fysi-webhook-receiver",
    expects: "POST",
    events: KNOWN_EVENTS,
  });
}
