import { getServerEnv } from "./env";
import { CLICKUP_STATUS_MAP } from "./clickup";
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
 * Listas de trabalho INTERNO (sem cliente) — ex.: "Tarefas Gestão de
 * projetos". Ficam fora do folder de projetos, e era por isso que demandas
 * reais não apareciam no app: o sync só olhava o folder. A Karine tinha
 * "Revisão dos grupos do WhatsApp" atribuída a ela e invisível aqui.
 */
const LISTAS_INTERNAS = (
  process.env.CLICKUP_INTERNAL_LIST_IDS ?? "901102129822"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * ClickUp user id → `responsavel` do app (TEAM_MEMBERS).
 * Configurável por env pra não precisar de deploy quando entrar gente nova.
 * Padrão = o workspace da Fysi hoje.
 *
 * Atenção: a Tainá NÃO está no workspace do ClickUp, então as demandas dela
 * nunca vêm daqui — são atribuídas pelo dono padrão do tipo de tarefa.
 * O Leonardo está no ClickUp mas é externo (ver TeamMember.externo): a
 * tarefa dele é atribuída a ele em vez de virar tarefa sem dono.
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
    "82109102": "leonardo", // Leonardo Santos — freelancer/externo
  };
}

/**
 * Status do ClickUp → status do app. Mesmo mapa do sync de PROJETOS — antes
 * eram duas cópias que divergiam: esta tinha "completo/entregue", mas o
 * ClickUp escreve "completo| entregue" (com barra vertical), então tarefa
 * entregue nunca era reconhecida. Faltavam também "ajuste implementação",
 * "nem começou nada" e os status das listas internas.
 */
const MAPA_STATUS = CLICKUP_STATUS_MAP;

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
  startDate: string | null;
  priority: string | null;
  parent: string | null;
  listName: string;
}

/**
 * Primeiro assignee QUE A EQUIPE RECONHECE, não o primeiro da lista.
 *
 * O ClickUp devolve os responsáveis sem ordem garantida, e tarefa da lista
 * de gestão costuma ter dois (ex.: "Revisão dos grupos do WhatsApp" tem a
 * Karine e uma ex-integrante). Pegando o [0] cego, a demanda virava "sem
 * dono" só porque a pessoa que saiu veio primeiro.
 */
function donoDe(
  assignees: { id?: number }[] | undefined,
  mapa: Record<string, string>
): string | null {
  for (const a of assignees ?? []) {
    const v = a?.id ? mapa[String(a.id)] : undefined;
    if (v) return v;
  }
  return null;
}

/** Título do ClickUp costuma vir com espaço sobrando ("Copy LP  Raynna"). */
function tituloDe(name: string | undefined): string {
  return (name ?? "").replace(/\s+/g, " ").trim();
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
        start_date?: unknown;
        priority?: { priority?: string } | null;
        parent?: string | null;
        list?: { name?: string };
      };
      tarefas.push({
        id: task.id,
        name: tituloDe(task.name),
        status: (task.status?.status ?? "").toLowerCase().trim(),
        assignee: donoDe(task.assignees, mapa),
        dueDate: dataDe(task.due_date),
        startDate: dataDe(task.start_date),
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

/** Tarefas das listas internas (trabalho da agência, sem cliente). */
async function buscarTarefasInternas(): Promise<TarefaClickUp[]> {
  const env = getServerEnv();
  if (!env.clickupToken || LISTAS_INTERNAS.length === 0) return [];
  const mapa = mapaResponsaveis();
  const out: TarefaClickUp[] = [];

  for (const listId of LISTAS_INTERNAS) {
    for (let page = 0; page < 10; page++) {
      const url =
        `https://api.clickup.com/api/v2/list/${listId}/task` +
        `?subtasks=true&include_closed=false&page=${page}`;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Authorization: env.clickupToken },
          cache: "no-store",
        });
      } catch {
        break;
      }
      if (!res.ok) break;
      const json = (await res.json()) as { tasks?: unknown[]; last_page?: boolean };
      const lote = json.tasks ?? [];
      for (const t of lote) {
        const task = t as {
          id: string;
          name?: string;
          status?: { status?: string };
          assignees?: { id?: number }[];
          due_date?: unknown;
          start_date?: unknown;
          priority?: { priority?: string } | null;
          parent?: string | null;
          list?: { name?: string };
        };
        out.push({
          id: task.id,
          name: tituloDe(task.name),
          status: (task.status?.status ?? "").toLowerCase().trim(),
          assignee: donoDe(task.assignees, mapa),
          dueDate: dataDe(task.due_date),
          startDate: dataDe(task.start_date),
          priority: task.priority?.priority
            ? (MAPA_PRIORIDADE[task.priority.priority] ?? null)
            : null,
          parent: task.parent ?? null,
          listName: task.list?.name ?? "",
        });
      }
      if (lote.length < 100 || json.last_page) break;
    }
  }
  return out;
}

export interface ResultadoSyncTarefas {
  ok: boolean;
  reason?: string;
  vinculadas: number;
  /** Existiam no ClickUp e não existiam aqui. */
  criadas: number;
  /** No ClickUp sem data ("Não programado") — não são trazidas. */
  ignoradasSemPrazo: number;
  /** Trabalho interno da agência (sem cliente) trazido das listas de gestão. */
  internasCriadas: number;
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
/**
 * Casa tarefa do ClickUp com `project_tasks`, preenche QUEM/QUANDO e **cria
 * o que existe no ClickUp e não existe aqui**.
 *
 * Por que criar passou a ser necessário: as duas listas nasceram separadas.
 * O app gerou tarefas pelo modelo (DEFAULT_PROJECT_TASKS) e o ClickUp tem as
 * reais — em 2026-09-21 a Karine tinha 177 tarefas no ClickUp e 10 aqui, com
 * `clickup_task_id` nulo em 100% das linhas. Só atualizar nunca ia alcançar.
 *
 * O que NÃO faz: apagar. O app tem etapas que o ClickUp não tem (Pagamento,
 * Envio Contrato) e sumir com elas perderia trabalho.
 */
export async function sincronizarTarefasDoClickUp(): Promise<ResultadoSyncTarefas> {
  const base: ResultadoSyncTarefas = {
    ok: false,
    vinculadas: 0,
    criadas: 0,
    ignoradasSemPrazo: 0,
    internasCriadas: 0,
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
      .select(
        "id, client_id, titulo, ordem, status, responsavel, data_vencimento, prioridade, clickup_task_id"
      ),
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
    ordem: number | null;
    status: string | null;
    responsavel: string | null;
    data_vencimento: string | null;
    prioridade: string | null;
    clickup_task_id: string | null;
  }
  const linhas = (tarefasData as Linha[] | null) ?? [];
  const porClickUpId = new Map<string, Linha>();
  const porCliente = new Map<string, Linha[]>();
  const maiorOrdem = new Map<string, number>();
  for (const l of linhas) {
    if (l.clickup_task_id) porClickUpId.set(l.clickup_task_id, l);
    const arr = porCliente.get(l.client_id);
    if (arr) arr.push(l);
    else porCliente.set(l.client_id, [l]);
    maiorOrdem.set(l.client_id, Math.max(maiorOrdem.get(l.client_id) ?? 0, l.ordem ?? 0));
  }

  // Ids já usados nesta rodada — duas tarefas do ClickUp não podem casar
  // com a mesma linha do app.
  const jaCasadas = new Set<string>();

  /**
   * Acha a linha do app equivalente. O modelo do app usa título genérico
   * ("Copy LP", "Design") e o ClickUp usa nomeado ("Copy LP Danielle",
   * "Design LP Ygor"), então título igual não basta.
   */
  function casarLinha(clientId: string, nomeClickUp: string): Linha | null {
    const cands = (porCliente.get(clientId) ?? []).filter(
      (l) => !l.clickup_task_id && !jaCasadas.has(l.id)
    );
    if (cands.length === 0) return null;
    const alvo = normalizar(nomeClickUp);

    const exatas = cands.filter((l) => normalizar(l.titulo) === alvo);
    if (exatas.length === 1) return exatas[0];

    // Prefixo nos dois sentidos: "copy lp danielle" começa com "copy lp".
    const prefixo = cands.filter((l) => {
      const t = normalizar(l.titulo);
      return t.length >= 4 && (alvo.startsWith(t) || t.startsWith(alvo));
    });
    if (prefixo.length === 1) return prefixo[0];
    // Empate: fica com o título mais longo (mais específico).
    if (prefixo.length > 1) {
      return prefixo.sort(
        (a, b) => normalizar(b.titulo).length - normalizar(a.titulo).length
      )[0];
    }
    return null;
  }

  const res: ResultadoSyncTarefas = { ...base, ok: true };
  const novas: Record<string, unknown>[] = [];

  for (const t of r.tarefas) {
    if (!t.assignee) res.semResponsavelNoClickUp += 1;

    // A tarefa que representa o PROJETO não vira etapa — ela É o projeto.
    if (projetoParaCliente.has(t.id)) continue;

    let alvo = porClickUpId.get(t.id) ?? null;
    let clientId = alvo?.client_id ?? null;

    if (!alvo) {
      clientId = t.parent ? (projetoParaCliente.get(t.parent) ?? null) : null;
      if (!clientId) {
        // Sem cliente conhecido não dá pra pendurar em lugar nenhum.
        res.semCorrespondencia += 1;
        continue;
      }
      alvo = casarLinha(clientId, t.name);
    }

    const statusApp = MAPA_STATUS[t.status] ?? null;

    if (!alvo) {
      // Existe no ClickUp e não existe aqui: cria.
      if (!clientId || !t.name) {
        res.semCorrespondencia += 1;
        continue;
      }
      // "Não programado" não entra (decisão da Karine em 2026-09-21): são
      // 168 tarefas sem data só dela. Sem prazo elas não têm o que fazer no
      // "Meu Trabalho", que é organizado por quando vence — e entupiriam a
      // lista. Tarefa que JÁ existe aqui continua sendo atualizada
      // normalmente, com ou sem prazo lá.
      if (!t.dueDate) {
        res.ignoradasSemPrazo += 1;
        continue;
      }
      const ordem = (maiorOrdem.get(clientId) ?? 0) + 1;
      maiorOrdem.set(clientId, ordem);
      novas.push({
        client_id: clientId,
        titulo: t.name,
        ordem,
        status: statusApp ?? "a-iniciar",
        responsavel: t.assignee ?? donoPadraoDe(t.name),
        data_inicial: t.startDate,
        data_vencimento: t.dueDate,
        prioridade: t.priority,
        origem: "clickup",
        clickup_task_id: t.id,
        clickup_sync_at: new Date().toISOString(),
      });
      res.criadas += 1;
      continue;
    }

    jaCasadas.add(alvo.id);

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

  // ---- Trabalho interno (sem cliente), das listas de gestão ----
  const internas = await buscarTarefasInternas();
  const idsInternosExistentes = new Set(
    linhas.map((l) => l.clickup_task_id).filter(Boolean) as string[]
  );
  for (const t of internas) {
    if (!t.name) continue;
    if (idsInternosExistentes.has(t.id)) continue;
    // Mesma regra do trabalho de cliente: sem data não entra.
    if (!t.dueDate) {
      res.ignoradasSemPrazo += 1;
      continue;
    }
    // Sem responsável não há em qual "Meu Trabalho" mostrar.
    if (!t.assignee) continue;
    novas.push({
      client_id: null,
      titulo: t.name,
      ordem: 0,
      status: MAPA_STATUS[t.status] ?? "a-iniciar",
      responsavel: t.assignee,
      data_inicial: t.startDate,
      data_vencimento: t.dueDate,
      prioridade: t.priority,
      origem: "clickup",
      clickup_task_id: t.id,
      clickup_sync_at: new Date().toISOString(),
    });
    res.internasCriadas += 1;
  }

  // Insere em lotes — uma chamada por tarefa nova estouraria o tempo da action.
  for (let i = 0; i < novas.length; i += 200) {
    const { error } = await service
      .from("project_tasks")
      .insert(novas.slice(i, i + 200));
    if (error) {
      res.criadas -= Math.min(200, novas.length - i);
      res.reason = `Algumas tarefas não puderam ser criadas: ${error.message}`;
    }
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
