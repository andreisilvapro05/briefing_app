import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { reconcileContract } from "@/lib/contract-reconcile";
import { logServerError } from "@/lib/api-helpers";

/**
 * Cron: reconcilia automaticamente os contratos pendentes com o Autentique.
 * Faz o "contrato assina sozinho" sem depender do clique manual (Caixa 5).
 *
 * Segurança: se CRON_SECRET estiver setado, exige Authorization: Bearer <ele>
 * (é o header que a Vercel Cron manda). Sem CRON_SECRET, roda liberado — mas
 * só sincroniza estado real do Autentique (idempotente, baixo risco).
 *
 * Ativar na Vercel: adicione ao vercel.json:
 *   { "crons": [{ "path": "/api/cron/reconcile-contracts",
 *                 "schedule": "*\/15 * * * *" }] }
 * (frequência sub-diária requer plano Pro; no Hobby use um schedule diário).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ mode: "demo", ok: true });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("id")
    .eq("contrato_status", "pendente")
    .not("autentique_document_id", "is", null)
    .limit(200);

  const ids = (data as { id: string }[] | null) ?? [];

  let novosAssinados = 0;
  for (const { id } of ids) {
    try {
      const r = await reconcileContract(id);
      if (r.status === "assinado" && r.changed) novosAssinados++;
    } catch (err) {
      logServerError("cron.reconcile-contracts", err);
    }
  }

  return NextResponse.json({
    ok: true,
    verificados: ids.length,
    novosAssinados,
  });
}
