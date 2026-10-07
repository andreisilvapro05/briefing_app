"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sincronizarStatusDosProjetos } from "@/lib/clickup-status-sync";
import {
  diagnosticarClickUp,
  type DiagnosticoClickUp,
} from "@/lib/clickup";
import { logServerError } from "@/lib/api-helpers";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";
import { maxStageIndexDe } from "@/lib/project-types";
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
import { semearMateriaisPadrao } from "@/lib/materiais-cliente-server";
import type { ProjectType } from "@/lib/types";

export interface SyncResultado {
  ok: boolean;
  atualizados: { projeto: string; de: string; para: string }[];
  jaEmDia: number;
  /** Vinculados a uma tarefa que não é de projeto (ex.: tarefa de briefing). */
  ignorados: number;
  /** Nasceram agora porque existiam só no ClickUp. */
  criados: { projeto: string; status: string }[];
  /** Já estavam aqui sem vínculo e acabaram de ser casados com a tarefa de lá. */
  vinculados: { projeto: string; motivo: string }[];
  /** Existem só lá e não foram criados — com o motivo, pra resolver na mão. */
  naoCriados: { projeto: string; motivo: string }[];
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
    criados: [],
    vinculados: [],
    naoCriados: [],
  };

  const member = await getCurrentMember({ urlKey });
  if (!member) return { ...vazio, erro: "Faça login de novo." };
  if (!hasFullAccess(member)) {
    return { ...vazio, erro: "Sem permissão para sincronizar." };
  }

  // O miolo vive em src/lib/clickup-status-sync.ts porque o CRON também
  // precisa dele, e Server Action exige membro logado.
  const r = await sincronizarStatusDosProjetos();
  if (!r.ok) return { ...vazio, erro: r.erro };

  revalidatePath("/admin/lista");
  revalidatePath("/admin/visao-geral");
  revalidatePath("/admin");
  // Projeto novo aparece também na lista de clientes e no quadro.
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/quadro");

  return {
    ok: true,
    atualizados: r.atualizados,
    jaEmDia: r.jaEmDia,
    ignorados: r.ignorados,
    criados: r.criados,
    vinculados: r.vinculados,
    naoCriados: r.naoCriados,
  };
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

/** Timeline mais curta por tipo — derivado da própria timeline. */
const maxStageIndex = maxStageIndexDe;

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
  // Definir o tipo do projeto e semear o checklist é decisão de OPERAÇÃO,
  // não de quem está marcado numa tarefa. Antes o escopo por cliente
  // deixava passar o desenvolvedor: com uma tarefa no cliente, ele podia
  // trocar o tipo e recuar a etapa que o próprio cliente vê no painel.
  // Achado da revisão de 22/09.
  if (!hasFullAccess(member)) {
    return falhar("Só quem tem acesso completo ajusta o projeto.");
  }

  const tipoEscolhido = String(formData.get("projectType") ?? "").trim();
  if (tipoEscolhido && !ehProjectType(tipoEscolhido)) {
    return falhar("Tipo de projeto inválido.");
  }
  const gerarChecklist = formData.get("gerarChecklist") === "on";
  /**
   * Semear a lista do que o cliente precisa enviar.
   *
   * Item 4 do processo da Karine (26/09): o envio de informações tem que
   * viver no app, não num documento do Drive. A lista existe desde 22/09
   * e só nasce junto com o checklist de tarefas — e quase todo projeto
   * teve o checklist gerado antes disso, então ficou sem.
   *
   * É marcável à parte de propósito: a lista aparece no LINK PÚBLICO do
   * briefing, então semear em lote, sozinho, mandaria uma lista de dez
   * cobranças pra clientes que já entregaram tudo meses atrás.
   */
  const semearMateriais = formData.get("semearMateriais") === "on";

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

  // 3) Lista do que o cliente precisa enviar.
  if (semearMateriais) {
    const r = await semearMateriaisPadrao(clientId);
    if (!r.ok) return falhar("Não consegui criar a lista de materiais.");
    feitos.push(
      r.criados > 0
        ? `lista de materiais criada (${r.criados} itens)`
        : "lista de materiais já existia"
    );
  }

  if (feitos.length === 0) {
    return falhar(
      "Nada pra ajustar: escolha um tipo novo, marque o checklist ou a lista de materiais."
    );
  }

  revalidatePath("/admin/lista");
  revalidatePath("/admin/visao-geral");
  revalidatePath("/admin/tarefas");
  revalidatePath("/admin");
  revalidatePath(`/admin/${clientId}`);

  return { ok: true, mensagem: feitos.join(" · "), clientId };
}

/**
 * Testa a ponte com o ClickUp e diz ONDE ela está quebrada.
 *
 * Karine (06/10): "não deu certo, não está atualizando no ClickUp". O
 * token vive só no Vercel e a resposta da API não aparece em lugar nenhum
 * da tela — sem isto, cada hipótese custa uma ida e volta com ela.
 */
export async function diagnosticarClickUpAction(
  urlKey: string | null
): Promise<DiagnosticoClickUp | { erro: string }> {
  const member = await getCurrentMember({ urlKey });
  if (!member) return { erro: "Faça login de novo." };
  if (!hasFullAccess(member)) return { erro: "Sem permissão." };
  try {
    return await diagnosticarClickUp();
  } catch (err) {
    logServerError("clickup.diagnostico", err);
    return { erro: "O teste quebrou. Veja os logs do servidor." };
  }
}
