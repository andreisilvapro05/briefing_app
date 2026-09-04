import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMember, getVisibleClientIds } from "@/lib/member";
import { listProjectTasks } from "@/lib/project-tasks-server";
import { errorResponse } from "@/lib/api-helpers";

/**
 * Subtarefas de UM cliente, sob demanda.
 *
 * Existe pra tirar peso das telas Lista por status e Visão Geral: elas
 * embutiam o array COMPLETO de tarefas de todos os clientes na resposta,
 * mesmo com o accordion fechado (medido: 217KB e 229KB, contra 69KB de
 * Cobranças). O accordion agora busca as tarefas só quando é aberto.
 *
 * Respeita o escopo por papel: "básico" só lê clientes em que está marcado.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const member = await getCurrentMember({ urlKey: url.searchParams.get("key") });
  if (!member) return errorResponse("unauthenticated", 401);

  const clientId = url.searchParams.get("clientId");
  if (!clientId) return errorResponse("client-id-missing", 400);

  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && !visibleIds.has(clientId)) {
    return errorResponse("forbidden", 403);
  }

  const tarefas = await listProjectTasks(clientId);
  return NextResponse.json({ tarefas });
}
