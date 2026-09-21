import { getServerEnv } from "./env";
import { createSupabaseServiceRoleClient } from "./supabase/server";
import { normalizar } from "./briefing-match";
import { donoPadraoDe } from "./project-tasks";

/**
 * Traz do ClickUp o que o app não sabia: QUEM é o responsável de cada
 * demanda, em que status ela está e pra quando é.
 *
 * O buraco que isso fecha: em 2026-09-20 havia 276 tarefas com
 * `responsavel = null` contra 61 preenchidas, então "Meu trabalho"
 * aparecia praticamente vazio pra todo mundo e a Tainá não tinha nenhuma.
 *
 * O ClickUp é a fonte da verdade do QUEM/QUANDO. O app continua dono do
 * que o ClickUp não tem (pagamento, contrato, briefing).
 */

const FOLDER_ID = process.env.CLICKUP_PROJECTS_FOLDER_ID ?? "90110919806";

/**
 * ClickUp user id → `responsavel` do app (TEAM_MEMBERS).
 * Configurável por env pra não precisar de deploy quando entrar gente nova.
 * Padrão = o workspace da Fysi hoje.
 *
 * Atenção: a Tainá NÃO está no workspace do ClickUp, então as demandas dela
 * nunca vêm daqui — têm que ser atribuídas no app.
 */
function mapaResponsaveis(): Record<string, string> {
  const bruto = process.env.CLICKUP_MEMBER_MAP;
  if (bruto) {
    try {
      return JSON.parse(bruto) as Record<string, string>;
    } catch {
      /* cai no padrão */
    }
  }
  return {
    "87402023": "valeria", // Valéria Nunes
    "49116767": "andrei", // Andrei
    "43099461": "karine", // karine de França sackt
  };
}

/** Status do ClickUp → status do app. */
const MAPA_STATUS: Record<string, string> = {
  "a iniciar": "a-iniciar",
  onboarding: "onboarding",
  "informações iniciais": "envio-informacoes",
  "redação/copy": "redacao-copy",
  "design da página": "design-pagina",
  "validação design+copy": "validacao-design-copy",
  "ajustes design/copy": "ajustes-design-copy",
  implementação: "implementacao",
  "validação implementação": "validacao-implementacao",
  "otimização+entrega": "otimizacao-entrega",
  concluído: "concluido",
  "completo/entregue": "completo-entregue",
  parado: "parado",
};

const MAPA_PRIORIDADE: Record<string, string> = {
  urgent: "urgente",
  high: "alta",
  normal: "normal",
  low: "baixa",
};

interface TarefaClickUp {
  id: string;
  name: string;
  status: string;
  assignee: string | null;
  dueDate: string | null;
  priority: string | null;
  parent: string | null;
  listName: string;
}

function dataDe(ms: unknown): string | null {
  const n = typeof ms === "string" ? Number(ms) : typeof ms === "number" ? ms : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString().slice(0, 10);
}

/** Pagina o folder inteiro (100 por vez) — a v2 não devolve tudo de uma vez. */
async function buscarTarefas(): Promise<
  { ok: true; tarefas: TarefaClickUp[] } | { ok: false; reason: string }
> {
  const env = getServerEnv();
  if (!env.clickupToken)
    return { ok: false, reason: "ClickUp não configurado (falta CLICKUP_API_TOKEN)." };

  const mapa = mapaResponsaveis();
  const tarefas: TarefaClickUp[] = [];

  for (let page = 0; page < 30; page++) {
    const url =
      `https://api.clickup.com/api/v2/folder/${FOLDER_ID}/task` +
      `?subtasks=true&include_closed=true&page=${page}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: env.clickupToken },
        cache: "no-store",
      });
    } catch {
      return { ok: false, reason: "Não consegui falar com o ClickUp." };
    }
    if (!res.ok)
      return { ok: false, reason: `ClickUp respondeu ${res.status} ao listar tarefas.` };

    const json = (await res.json()) as {
      tasks?: unknown[];
      last_page?: boolean;
    };
    const lote = json.tasks ?? [];
    for (const t of lote) {
      const task = t as {
        id: string;
        name?: string;
        status?: { status?: string };
        assignees?: { id?: number }[];
        due_date?: unknown;
        priority?: { priority?: string } | null;
        parent?: string | null;
        list?: { name?: string };
      };
      const primeiro = task.assignees?.[0]?.id;
      tarefas.push({
        id: task.id,
        name: (task.name ?? "").trim(),
        status: (task.status?.status ?? "").toLowerCase().trim(),
        assignee: primeiro ? (mapa[String(primeiro)] ?? null) : null,
        dueDate: dataDe(task.due_date),
        priority: task.priority?.priority
          ? (MAPA_PRIORIDADE[task.priority.priority] ?? null)
          : null,
        parent: task.parent ?? null,
        listName: task.list?.name ?? "",
      });
    }
    if (lote.length < 100 || json.last_page) break;
  }

  return { ok: true, tarefas };
}

export interface ResultadoSyncTarefas {
  ok: boolean;
  reason?: string;
  vinculadas: number;
  responsavelDefinido: number;
  statusAtualizado: number;
  prazoAtualizado: number;
  semCorrespondencia: number;
  semResponsavelNoClickUp: number;
}

/**
 * Casa tarefa do ClickUp com `project_tasks` e preenche QUEM/QUANDO.
 *
 * Estratégia de casamento, em ordem:
 *  1. `clickup_task_id` já gravado (sync anterior) — direto;
 *  2. tarefa-pai do ClickUp que casa com o `clickup_task_id` do cliente,
 *     + título da subtarefa ≈ título da tarefa no app.
 *
 * NÃO cria tarefa nova e NÃO apaga: o app tem etapas que o ClickUp não tem
 * (Pagamento, Envio Contrato) e sobrescrever perderia trabalho.
 */
export async function sincronizarTarefasDoClickUp(): Promise<ResultadoSyncTarefas> {
  const base: ResultadoSyncTarefas = {
    ok: false,
    vinculadas: 0,
    responsavelDefinido: 0,
    statusAtualizado: 0,
    prazoAtualizado: 0,
    semCorrespondencia: 0,
    semResponsavelNoClickUp: 0,
  };

  const r = await buscarTarefas();
  if (!r.ok) return { ...base, reason: r.reason };

  const service = createSupabaseServiceRoleClient();
  const [{ data: clientesData }, { data: tarefasData }] = await Promise.all([
    service.from("clients").select("id, clickup_task_id").not("clickup_task_id", "is", null),
    service
      .from("project_tasks")
      .select("id, client_id, titulo, status, responsavel, data_vencimento, prioridade, clickup_task_id"),
  ]);

  // clickup_task_id do PROJETO → client_id no app.
  const projetoParaCliente = new Map<string, string>();
  for (const c of (clientesData as { id: string; clickup_task_id: string }[] | null) ?? []) {
    projetoParaCliente.set(c.clickup_task_id, c.id);
  }

  interface Linha {
    id: string;
    client_id: string;
    titulo: string;
    status: string | null;
    responsavel: string | null;
    data_vencimento: string | null;
    prioridade: string | null;
    clickup_task_id: string | null;
  }
  const linhas = (tarefasData as Linha[] | null) ?? [];
  const porClickUpId = new Map<string, Linha>();
  const porClienteTitulo = new Map<string, Linha[]>();
  for (const l of linhas) {
    if (l.clickup_task_id) porClickUpId.set(l.clickup_task_id, l);
    const chave = `${l.client_id}::${normalizar(l.titulo)}`;
    const arr = porClienteTitulo.get(chave);
    if (arr) arr.push(l);
    else porClienteTitulo.set(chave, [l]);
  }

  const res: ResultadoSyncTarefas = { ...base, ok: true };

  for (const t of r.tarefas) {
    if (!t.assignee) res.semResponsavelNoClickUp += 1;

    let alvo = porClickUpId.get(t.id) ?? null;

    if (!alvo && t.parent) {
      const clientId = projetoParaCliente.get(t.parent);
      if (clientId) {
        const cands = porClienteTitulo.get(`${clientId}::${normalizar(t.name)}`);
        // Só aceita quando é inequívoco — "Ajustes" casaria com v1/v2/v3.
        if (cands?.length === 1) alvo = cands[0];
      }
    }

    if (!alvo) {
      res.semCorrespondencia += 1;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (!alvo.clickup_task_id) {
      patch.clickup_task_id = t.id;
      res.vinculadas += 1;
    }
    // Responsável: o ClickUp manda. Só não apaga o que o app já tem quando
    // a tarefa está sem ninguém lá.
    if (t.assignee && t.assignee !== alvo.responsavel) {
      patch.responsavel = t.assignee;
      res.responsavelDefinido += 1;
    }
    const statusApp = MAPA_STATUS[t.status];
    // "envio-informacoes" é etapa só do app — não deixa o ClickUp derrubar.
    if (statusApp && statusApp !== alvo.status && alvo.status !== "envio-informacoes") {
      patch.status = statusApp;
      res.statusAtualizado += 1;
    }
    if (t.dueDate && t.dueDate !== alvo.data_vencimento) {
      patch.data_vencimento = t.dueDate;
      res.prazoAtualizado += 1;
    }
    if (t.priority && t.priority !== alvo.prioridade) {
      patch.prioridade = t.priority;
    }

    if (Object.keys(patch).length === 0) continue;
    patch.clickup_sync_at = new Date().toISOString();
    await service.from("project_tasks").update(patch).eq("id", alvo.id);
  }

  return res;
}

export interface ResultadoDonoPadrao {
  preenchidas: number;
  restantesSemDono: number;
  porPessoa: Record<string, number>;
}

/**
 * Preenche o responsável das tarefas que continuaram SEM ninguém depois do
 * sync — usando o dono padrão do tipo de tarefa (ver DONO_PADRAO_POR_TAREFA).
 *
 * Nunca toca em tarefa que já tem responsável, e nunca em tarefa fechada
 * (atribuir dono a coisa entregue só polui o "Meu trabalho" de alguém).
 */
export async function preencherDonosPadrao(): Promise<ResultadoDonoPadrao> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("id, titulo, status")
    .is("responsavel", null);

  const linhas = (data as { id: string; titulo: string; status: string | null }[] | null) ?? [];
  const porPessoa: Record<string, number> = {};
  let preenchidas = 0;
  let restantes = 0;

  // Agrupa por responsável pra fazer poucos UPDATEs em vez de um por linha.
  const lotes = new Map<string, string[]>();
  for (const l of linhas) {
    if (l.status === "completo-entregue" || l.status === "concluido") continue;
    const dono = donoPadraoDe(l.titulo);
    if (!dono) {
      restantes += 1;
      continue;
    }
    const arr = lotes.get(dono);
    if (arr) arr.push(l.id);
    else lotes.set(dono, [l.id]);
  }

  for (const [dono, ids] of lotes) {
    for (let i = 0; i < ids.length; i += 100) {
      const fatia = ids.slice(i, i + 100);
      const { error } = await service
        .from("project_tasks")
        .update({ responsavel: dono })
        .in("id", fatia);
      if (!error) {
        preenchidas += fatia.length;
        porPessoa[dono] = (porPessoa[dono] ?? 0) + fatia.length;
      }
    }
  }

  return { preenchidas, restantesSemDono: restantes, porPessoa };
}
