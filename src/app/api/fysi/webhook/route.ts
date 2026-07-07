import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import type { DashboardEvent } from "@/lib/dashboard-webhook";

/**
 * Receiver do webhook outbound do próprio briefing_app.
 *
 * Valida HMAC-SHA256 via X-Fysi-Signature usando DASHBOARD_WEBHOOK_SECRET,
 * loga o evento e ENCAMINHA pro app-financeiro (re-assinado com o segredo
 * do receiver lá). Isso permite que o briefing_app continue despachando
 * com a env DASHBOARD_WEBHOOK_URL apontando pra ele mesmo, e ainda assim
 * o evento chegue no dashboard financeiro.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_EVENTS: ReadonlyArray<DashboardEvent> = [
  "cliente.criado",
  "cliente.atualizado",
  "contrato.assinado",
  "pagamento.atualizado",
  "cobranca.paga",
];

// A URL e o SEGREDO do receiver vêm de env (FYSI_RECEIVER_URL /
// FYSI_RECEIVER_SECRET). O segredo NÃO fica mais hardcoded no código.

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

  // Encaminha pro app-financeiro re-assinando com o segredo de lá.
  // Sem FYSI_RECEIVER_SECRET configurado, o forward é pulado (não trava).
  let forwarded = false;
  let forwardStatus = 0;
  if (!env.receiverWebhookSecret) {
    console.warn(
      "[fysi-webhook] FYSI_RECEIVER_SECRET ausente — forward pulado",
    );
  } else {
    const outgoingSig = createHmac("sha256", env.receiverWebhookSecret)
      .update(rawBody)
      .digest("hex");
    try {
      const res = await fetch(env.receiverWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fysi-Event": event,
          "X-Fysi-Signature": outgoingSig,
        },
        body: rawBody,
      });
      forwarded = res.ok;
      forwardStatus = res.status;
      if (!res.ok) {
        const txt = await res.text();
        console.warn(
          `[fysi-webhook] forward falhou status=${res.status} body=${txt.slice(0, 200)}`,
        );
      }
    } catch (err) {
      console.warn(
        `[fysi-webhook] forward erro:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({ ok: true, event, forwarded, forwardStatus });
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
