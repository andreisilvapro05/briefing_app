import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Recebe negócios fechados do CRM (sistema separado do usuário) e grava em
 * public.closed_projects. Mesma validação HMAC-SHA256 do webhook do
 * dashboard financeiro (X-Fysi-Signature, CRM_WEBHOOK_SECRET no lugar de
 * DASHBOARD_WEBHOOK_SECRET) — ver src/app/api/fysi/webhook/route.ts.
 *
 * Idempotente por `proposal_id`: se vier preenchido, faz upsert (reenviar o
 * mesmo negócio — ex: mudança de status ou pagamento — atualiza a linha em
 * vez de duplicar). Sem `proposal_id`, cada chamada insere uma linha nova
 * (não há como o servidor saber que é o "mesmo" negócio).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClosedProjectPayload {
  client_name?: string;
  closed_date?: string | null;
  proposal_link?: string | null;
  plan_name?: string | null;
  contract_status?: string;
  payment_method?: string;
  value?: number;
  responsavel?: string | null;
  proposal_id?: string | null;
  notes?: string | null;
}

function verifySignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
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
    logServerError("crm-closed-projects:env", err);
    return errorResponse("env-missing", 500);
  }

  if (!env.crmWebhookSecret) {
    return errorResponse("secret-missing", 500);
  }

  // Body precisa ser raw pra validar o HMAC com os bytes exatos assinados.
  const rawBody = await request.text();
  const signature = request.headers.get("x-fysi-signature") ?? "";
  if (!signature) {
    return errorResponse("missing-signature", 401);
  }
  if (!verifySignature(rawBody, signature, env.crmWebhookSecret)) {
    return errorResponse("invalid-signature", 401);
  }

  let payload: ClosedProjectPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse("invalid-json", 400);
  }

  const clientName = (payload.client_name ?? "").trim();
  if (!clientName) {
    return errorResponse("client_name-required", 400);
  }

  const row = {
    client_name: clientName,
    closed_date: payload.closed_date ?? null,
    proposal_link: payload.proposal_link ?? "",
    plan_name: payload.plan_name ?? "",
    contract_status: payload.contract_status ?? "negociacao",
    payment_method: payload.payment_method ?? "nao_efetuado",
    value: typeof payload.value === "number" ? payload.value : 0,
    responsavel: payload.responsavel ?? "",
    proposal_id: payload.proposal_id ?? null,
    notes: payload.notes ?? "",
    updated_at: new Date().toISOString(),
  };

  const service = createSupabaseServiceRoleClient();
  const query = row.proposal_id
    ? service.from("closed_projects").upsert(row, { onConflict: "proposal_id" })
    : service.from("closed_projects").insert(row);

  const { data, error } = await query.select("id").single();
  if (error) {
    logServerError("crm-closed-projects:write", error);
    return errorResponse("write-failed", 500, error);
  }

  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}

// GET pra health-check rápido (sem expor segredo) — confirma só que a
// rota existe.
export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "crm-closed-projects-receiver",
    expects: "POST",
    signatureHeader: "X-Fysi-Signature",
  });
}
