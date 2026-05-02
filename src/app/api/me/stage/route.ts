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
      .select("current_stage_index, status, project_type")
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
    });
  } catch (err) {
    logServerError("me.stage.unexpected", err);
    return errorResponse("internal", 500);
  }
}
