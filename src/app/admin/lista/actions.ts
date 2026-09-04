"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, hasFullAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchClickUpProjectStatuses } from "@/lib/clickup";
import { logServerError } from "@/lib/api-helpers";

export interface SyncResultado {
  ok: boolean;
  atualizados: { projeto: string; de: string; para: string }[];
  jaEmDia: number;
  /** Vinculados a uma tarefa que não é de projeto (ex.: tarefa de briefing). */
  ignorados: number;
  erro?: string;
}

/**
 * Puxa o status atual de cada projeto do ClickUp e atualiza os que estão
 * defasados. Só de ida ClickUp → app: o ClickUp é a fonte da verdade do
 * andamento; o app é onde o resto da operação acontece.
 *
 * Projetos em `envio-informacoes` são preservados — esse estágio não existe
 * no ClickUp e sincronizar rebaixaria para `onboarding`.
 */
export async function syncClickUpStatusAction(
  urlKey: string | null
): Promise<SyncResultado> {
  const vazio: SyncResultado = {
    ok: false,
    atualizados: [],
    jaEmDia: 0,
    ignorados: 0,
  };

  const member = await getCurrentMember({ urlKey });
  if (!member) return { ...vazio, erro: "Faça login de novo." };
  if (!hasFullAccess(member)) {
    return { ...vazio, erro: "Sem permissão para sincronizar." };
  }

  let leitura: Awaited<ReturnType<typeof fetchClickUpProjectStatuses>>;
  try {
    leitura = await fetchClickUpProjectStatuses();
  } catch (err) {
    logServerError("clickup.sync.fetch", err);
    return { ...vazio, erro: "Não consegui falar com o ClickUp agora." };
  }
  if ("skipped" in leitura) return { ...vazio, erro: leitura.reason };

  const porTaskId = new Map(leitura.statuses.map((s) => [s.taskId, s.statusApp]));

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("clients")
    .select("id, nome, empresa, status, clickup_task_id")
    .not("clickup_task_id", "is", null);
  if (error) {
    logServerError("clickup.sync.clients", error);
    return { ...vazio, erro: "Não consegui ler os projetos." };
  }

  const clientes = (data ?? []) as {
    id: string;
    nome: string | null;
    empresa: string | null;
    status: string | null;
    clickup_task_id: string;
  }[];

  const atualizados: SyncResultado["atualizados"] = [];
  let jaEmDia = 0;
  let ignorados = 0;

  for (const c of clientes) {
    const novo = porTaskId.get(c.clickup_task_id);
    if (!novo) {
      ignorados++; // tarefa de briefing, ou fora do folder de projetos
      continue;
    }
    // Estágio que só existe no app — não rebaixar.
    if (c.status === "envio-informacoes") {
      ignorados++;
      continue;
    }
    if (c.status === novo) {
      jaEmDia++;
      continue;
    }
    const { error: updErr } = await service
      .from("clients")
      .update({ status: novo, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (updErr) {
      logServerError("clickup.sync.update", updErr);
      continue;
    }
    atualizados.push({
      projeto: c.empresa?.trim() || c.nome || "(sem nome)",
      de: c.status ?? "—",
      para: novo,
    });
  }

  revalidatePath("/admin/lista");
  revalidatePath("/admin/visao-geral");
  revalidatePath("/admin");

  return { ok: true, atualizados, jaEmDia, ignorados };
}
