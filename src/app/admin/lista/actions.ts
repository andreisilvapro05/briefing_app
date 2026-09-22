"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchClickUpProjectStatuses } from "@/lib/clickup";
import { logServerError } from "@/lib/api-helpers";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";
import {
  DEFAULT_PROJECT_TASKS,
  DEFAULT_TASK_STATUS,
  donoPadraoDe,
  type TaskStatus,
} from "@/lib/project-tasks";
import {
  ehProjectType,
  tarefasFaltando,
  type AjusteProjetoState,
} from "@/lib/projetos-incompletos";
import type { ProjectType } from "@/lib/types";

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

/* ------------------------------------------------------------------ */
/* Projetos incompletos — ver src/lib/projetos-incompletos.ts          */
/* ------------------------------------------------------------------ */

/**
 * Status inicial não-default por etapa do modelo. Espelha o
 * SEED_STATUS_OVERRIDES de src/app/admin/[id]/actions.ts (a lista de lá
 * atende a ficha do cliente; duplicar aqui evita conflito de edição no
 * arquivo grande, e são três linhas).
 */
const STATUS_INICIAL_DA_TAREFA: Partial<Record<string, TaskStatus>> = {
  "Envio Contrato": "onboarding",
  Pagamento: "onboarding",
  "Informações Iniciais": "envio-informacoes",
};

/** Timeline mais curta por tipo — mesmo clamp do setProjectTypeAction. */
function maxStageIndex(projectType: ProjectType): number {
  if (projectType === "landing-sem-copy") return 4;
  if (projectType === "outro") return 3;
  return 5;
}

/**
 * Completa um projeto que nasceu pela metade: define o tipo e/ou gera as
 * tarefas do modelo que ainda faltam.
 *
 * NADA roda sozinho — só o que vier marcado no formulário. Pedido da
 * Karine: "ter a opção de ajustar isso", não correção silenciosa.
 *
 * Gerar é idempotente: compara por ETAPA (etapaDaTarefa), então um projeto
 * que já tem "Copy LP Danielle" vinda do ClickUp não ganha uma "Copy LP"
 * duplicada.
 */
export async function ajustarProjetoAction(
  _anterior: AjusteProjetoState,
  formData: FormData
): Promise<AjusteProjetoState> {
  const clientId = String(formData.get("clientId") ?? "").trim();
  const urlKey = String(formData.get("key") ?? "") || null;
  const falhar = (mensagem: string): AjusteProjetoState => ({
    ok: false,
    mensagem,
    clientId: clientId || null,
  });

  if (!clientId) return falhar("Projeto não identificado.");

  const member = await getCurrentMember({ urlKey });
  if (!member) return falhar("Faça login de novo.");
  // getCurrentMember é autenticação, não autorização: "basico" só mexe nos
  // projetos em que está marcado (mesma regra de requireClientAccess).
  if (!hasFullAccess(member)) {
    const visiveis = await getVisibleClientIds(member);
    if (visiveis && !visiveis.has(clientId)) {
      return falhar("Você não tem acesso a este projeto.");
    }
  }

  const tipoEscolhido = String(formData.get("projectType") ?? "").trim();
  if (tipoEscolhido && !ehProjectType(tipoEscolhido)) {
    return falhar("Tipo de projeto inválido.");
  }
  const gerarChecklist = formData.get("gerarChecklist") === "on";

  const service = createSupabaseServiceRoleClient();
  const { data: clienteRow, error: leituraErr } = await service
    .from("clients")
    .select("id, project_type, current_stage_index")
    .eq("id", clientId)
    .maybeSingle();
  if (leituraErr || !clienteRow) {
    logServerError("ajustarProjeto.leitura", leituraErr);
    return falhar("Não consegui ler este projeto.");
  }
  const cliente = clienteRow as {
    project_type: ProjectType | null;
    current_stage_index: number | null;
  };

  const feitos: string[] = [];

  // 1) Tipo de projeto — só grava se mudou de fato.
  let tipoFinal: ProjectType | null = cliente.project_type;
  if (tipoEscolhido && tipoEscolhido !== cliente.project_type) {
    const novoTipo = tipoEscolhido as ProjectType;
    // Trocar pra uma timeline mais curta sem clamp deixaria a etapa atual
    // fora da faixa e o dashboard do cliente mostraria tudo concluído.
    const clamped = Math.min(
      cliente.current_stage_index ?? 0,
      maxStageIndex(novoTipo)
    );
    const { error: tipoErr } = await service
      .from("clients")
      .update({
        project_type: novoTipo,
        current_stage_index: clamped,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
    if (tipoErr) {
      logServerError("ajustarProjeto.tipo", tipoErr);
      return falhar("Não consegui salvar o tipo de projeto.");
    }
    tipoFinal = novoTipo;
    feitos.push(`tipo definido como ${PROJECT_TYPE_LABELS[novoTipo] ?? novoTipo}`);
  }

  // 2) Checklist de tarefas do modelo.
  if (gerarChecklist) {
    if (!tipoFinal) {
      return falhar("Escolha o tipo de projeto antes de gerar o checklist.");
    }
    const { data: existentesRows, error: tarefasErr } = await service
      .from("project_tasks")
      .select("titulo, ordem")
      .eq("client_id", clientId);
    if (tarefasErr) {
      logServerError("ajustarProjeto.tarefas", tarefasErr);
      return falhar("Não consegui ler as tarefas deste projeto.");
    }
    const existentes = (existentesRows as { titulo: string; ordem: number }[]) ?? [];
    const faltando = tarefasFaltando(
      tipoFinal,
      existentes.map((t) => t.titulo)
    );

    if (faltando.length === 0) {
      feitos.push("checklist já estava completo");
    } else {
      const modelo = DEFAULT_PROJECT_TASKS[tipoFinal] ?? [];
      const { error: insercaoErr } = await service.from("project_tasks").insert(
        faltando.map((titulo) => ({
          client_id: clientId,
          titulo,
          // Posição no modelo — assim um projeto do zero nasce na ordem
          // certa. As tarefas que já existiam ficam onde estão (dá pra
          // arrastar depois, como em qualquer lista do app).
          ordem: Math.max(0, modelo.indexOf(titulo)),
          origem: "template" as const,
          status: STATUS_INICIAL_DA_TAREFA[titulo] ?? DEFAULT_TASK_STATUS,
          // Nasce com dono: tarefa sem responsável não aparece no "Meu
          // trabalho" de ninguém — foi o buraco que DONO_PADRAO_POR_TAREFA
          // veio tapar.
          responsavel: donoPadraoDe(titulo),
        }))
      );
      if (insercaoErr) {
        logServerError("ajustarProjeto.insert", insercaoErr);
        return falhar("Não consegui gerar as tarefas.");
      }
      feitos.push(
        `${faltando.length} ${faltando.length === 1 ? "tarefa gerada" : "tarefas geradas"}`
      );
    }
  }

  if (feitos.length === 0) {
    return falhar("Nada pra ajustar: escolha um tipo novo ou marque o checklist.");
  }

  revalidatePath("/admin/lista");
  revalidatePath("/admin/visao-geral");
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin");
  revalidatePath(`/admin/${clientId}`);

  return { ok: true, mensagem: feitos.join(" · "), clientId };
}
