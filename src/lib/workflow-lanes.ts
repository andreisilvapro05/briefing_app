import type { ProjectType } from "./types";
import {
  DEFAULT_TASK_STATUS,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_VALUES,
  type TaskStatus,
} from "./project-tasks";

/**
 * Lanes do quadro Kanban do admin — derivadas a partir de campos que já
 * existem em `clients` (status, contrato_status, briefing_submitted_at,
 * chamada_agendada_at). Sem novas colunas em `clients`.
 *
 * Fluxo de vida do cliente, da esquerda pra direita:
 *
 *   1. Lead (sem contrato preenchido)
 *   2. Aguardando contrato (contrato preenchido, contrato_status != assinado)
 *   3. Aguardando chamada (contrato assinado, chamada não agendada)
 *   4. Briefing em progresso (chamada feita, briefing não submetido)
 *   5+. Uma lane por valor de `clients.status` — os 14 status reais do
 *      ClickUp (Parado, Onboarding, Redação/Copy, ..., Completo|Entregue),
 *      o status do próprio projeto principal (editável via StatusChanger).
 *      Substitui o heurístico antigo baseado em current_stage_index e a
 *      derivação intermediária a partir do status das tarefas internas.
 *
 * 2026-08-30/31: decisão explícita do usuário — manter o funil comercial
 * (lanes 1-4) como está; a fase de produção (5+) usa o status do PROJETO
 * PRINCIPAL (clients.status), não o status das tarefas internas
 * (project_tasks) — são dois níveis distintos, como no ClickUp.
 */

export interface ClientForLane {
  id: string;
  nome: string;
  empresa: string | null;
  project_type: ProjectType | null;
  status: string | null;
  current_stage_index: number | null;
  briefing_submitted_at: string | null;
  contrato_preenchido_at: string | null;
  chamada_agendada_at: string | null;
  contrato_status: string | null;
  pagamento_total: number | null;
  pagamento_pago: number | null;
  last_client_activity_at: string | null;
  created_at: string;
}

export interface Lane {
  id: string;
  label: string;
  tone: "slate" | "indigo" | "yellow" | "pink" | "violet" | "amber" | "red" | "orange" | "emerald" | "rose";
  description?: string;
}

/** Prefixo do id de lane pra cada TaskStatus — ver `statusLaneId`. */
const STATUS_LANE_PREFIX = "status-";

export function statusLaneId(status: TaskStatus): string {
  return `${STATUS_LANE_PREFIX}${status}`;
}

/**
 * Tom de cada status de tarefa, reaproveitando os tons NOMEADOS que já
 * existem em `Lane["tone"]` (não os hex/classes crus de `TASK_STATUS_TONE`,
 * que são de um sistema de cor diferente, usado no board de Tarefas).
 * Mantém a mesma família de cor entre as duas telas (ex: "Parado" é
 * vermelho nos dois lugares) sem precisar unificar os dois sistemas.
 */
const STATUS_TONE: Record<TaskStatus, Lane["tone"]> = {
  parado: "red",
  "nem-comecou-nada": "slate",
  "a-iniciar": "slate",
  onboarding: "indigo",
  "redacao-copy": "pink",
  "design-pagina": "violet",
  "validacao-design-copy": "red",
  "ajustes-design-copy": "amber",
  implementacao: "orange",
  "validacao-implementacao": "red",
  "ajuste-implementacao": "amber",
  "otimizacao-entrega": "orange",
  concluido: "emerald",
  "completo-entregue": "emerald",
};

/** Uma lane por valor de `clients.status` — ver header do arquivo. */
const PRODUCTION_LANES: Lane[] = TASK_STATUS_OPTIONS.map((opt) => ({
  id: statusLaneId(opt.value),
  label: opt.label.toUpperCase(),
  tone: STATUS_TONE[opt.value],
}));

/**
 * Lanes do KANBAN GERAL — independente de project_type, mostra o fluxo
 * comercial + produção em alto nível.
 */
export const GENERAL_LANES: Lane[] = [
  { id: "lead",              label: "LEAD",                tone: "slate",   description: "Cliente cadastrado, sem contrato preenchido" },
  { id: "contrato_aberto",   label: "AGUARDANDO CONTRATO", tone: "indigo",  description: "Dados de contrato enviados, esperando assinatura" },
  { id: "agendar_chamada",   label: "AGENDAR CHAMADA",     tone: "yellow",  description: "Contrato assinado, agendar onboarding" },
  { id: "briefing",          label: "BRIEFING",            tone: "pink",    description: "Cliente preenchendo briefing" },
  ...PRODUCTION_LANES,
];

const STUCK_DAYS = 14;

/**
 * Cliente sem atividade (do lado dele) há STUCK_DAYS+ dias — independente
 * da fase em que está. Não é mais uma lane própria (escondia em que etapa
 * o projeto realmente travou); é um indicador à parte que a UI mostra ao
 * lado da fase real (ver [[feedback_principios_editavel_ordenavel_claro]] —
 * clareza sobre em que etapa está cada projeto).
 */
export function isClientStuck(c: ClientForLane, now: number = Date.now()): boolean {
  const ref = c.last_client_activity_at ?? c.created_at;
  const days = Math.floor((now - new Date(ref).getTime()) / 86_400_000);
  return days >= STUCK_DAYS;
}

/**
 * Mapeia um cliente para sua lane atual. Se o cliente já tem pelo menos uma
 * tarefa de produção gerada (`project_tasks`), a lane vem 100% do status do
 * projeto — os campos de funil comercial (contrato/chamada/briefing) são
 * ignorados. Muitos clientes legados nunca passaram pelo onboarding do app
 * (vieram de fora, direto pra produção) e ficam com esses campos vazios pra
 * sempre; usar esses campos pra quem já tem tarefas geradas classificava
 * quase todo mundo como "lead"/"aguardando contrato" quando na real já
 * estava em produção (confirmado: 30 de 33 clientes com tarefas geradas
 * caíam no funil comercial em 2026-08-31, achado do usuário). Só quem
 * ainda NÃO tem nenhuma tarefa gerada usa o funil comercial de fato.
 * Determinístico, sem efeitos colaterais. Sempre a fase REAL — inatividade
 * não empurra o cliente pra uma lane "parado" à parte (ver isClientStuck).
 */
export function laneForClient(c: ClientForLane, hasTasks = false): string {
  if (!hasTasks) {
    if (!c.contrato_preenchido_at) {
      return "lead";
    }
    if (c.contrato_status !== "assinado") {
      return "contrato_aberto";
    }
    if (!c.chamada_agendada_at) {
      return "agendar_chamada";
    }
    if (!c.briefing_submitted_at) {
      return "briefing";
    }
  }

  // Produção — status do projeto principal. Cai no default se o valor não
  // for um dos 14 reconhecidos (ex: ambiente sem a migration aplicada) —
  // sem isso o cliente some silenciosamente de todos os quadros do admin.
  const status = TASK_STATUS_VALUES.includes(c.status as TaskStatus)
    ? (c.status as TaskStatus)
    : DEFAULT_TASK_STATUS;
  return statusLaneId(status);
}

/**
 * Stats agregadas pra relatórios.
 */
export interface ClientStats {
  total: number;
  porLane: Map<string, ClientForLane[]>;
  porTipo: Map<string, number>;
  porStatus: Map<string, number>;
  receitaTotal: number;
  receitaPaga: number;
  receitaPendente: number;
  parados: ClientForLane[];
  mediaPorMes: number;
  ultimosMeses: Array<{ label: string; count: number }>;
}

export function computeStats(
  clients: ClientForLane[],
  clientIdsWithTasks: Set<string> = new Set()
): ClientStats {
  const porLane = new Map<string, ClientForLane[]>();
  GENERAL_LANES.forEach((l) => porLane.set(l.id, []));
  const porTipo = new Map<string, number>();
  const porStatus = new Map<string, number>();
  let receitaTotal = 0;
  let receitaPaga = 0;
  const parados: ClientForLane[] = [];

  clients.forEach((c) => {
    const lane = laneForClient(c, clientIdsWithTasks.has(c.id));
    porLane.get(lane)?.push(c);

    const tipo = c.project_type ?? "—";
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
    const st = c.status ?? "—";
    porStatus.set(st, (porStatus.get(st) ?? 0) + 1);

    if (c.pagamento_total) receitaTotal += Number(c.pagamento_total);
    if (c.pagamento_pago) receitaPaga += Number(c.pagamento_pago);

    if (isClientStuck(c)) parados.push(c);
  });

  // Últimos 6 meses — count de novos clientes por mês
  const meses: Array<{ label: string; count: number; key: string }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    meses.push({ label, count: 0, key });
  }
  clients.forEach((c) => {
    if (!c.created_at) return;
    const d = new Date(c.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = meses.find((m) => m.key === key);
    if (m) m.count++;
  });

  const totalUltimos = meses.reduce((s, m) => s + m.count, 0);
  const mediaPorMes = totalUltimos / 6;

  return {
    total: clients.length,
    porLane,
    porTipo,
    porStatus,
    receitaTotal,
    receitaPaga,
    receitaPendente: receitaTotal - receitaPaga,
    parados,
    mediaPorMes,
    ultimosMeses: meses.map(({ label, count }) => ({ label, count })),
  };
}

export const LANE_TONE_CLASSES: Record<Lane["tone"], { bg: string; border: string; text: string; dot: string }> = {
  slate:   { bg: "bg-fysi-cream/40",  border: "border-fysi-line",         text: "text-fysi-deep/70", dot: "bg-fysi-muted"       },
  indigo:  { bg: "bg-indigo-50",      border: "border-indigo-200",        text: "text-indigo-700",   dot: "bg-indigo-500"       },
  yellow:  { bg: "bg-fysi-yellow/20", border: "border-fysi-yellow",       text: "text-fysi-deep",    dot: "bg-fysi-yellow"      },
  pink:    { bg: "bg-pink-50",        border: "border-pink-200",          text: "text-pink-700",     dot: "bg-pink-500"         },
  violet:  { bg: "bg-violet-50",      border: "border-violet-200",        text: "text-violet-700",   dot: "bg-violet-500"       },
  amber:   { bg: "bg-amber-50",       border: "border-amber-200",         text: "text-amber-700",    dot: "bg-amber-500"        },
  red:     { bg: "bg-red-50",         border: "border-red-200",           text: "text-red-700",      dot: "bg-red-500"          },
  orange:  { bg: "bg-orange-50",      border: "border-orange-200",        text: "text-orange-700",   dot: "bg-orange-500"       },
  emerald: { bg: "bg-fysi-mint",      border: "border-fysi-mint-vivid/40",text: "text-fysi-deep",    dot: "bg-fysi-mint-vivid"  },
  rose:    { bg: "bg-rose-50",        border: "border-rose-200",          text: "text-rose-700",     dot: "bg-rose-500"         },
};
