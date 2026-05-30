import type { ProjectType } from "./types";
import { buildTimeline } from "./project-types";

/**
 * Lanes do quadro Kanban do admin — derivadas a partir de campos que já
 * existem em `clients` (status, current_stage_index, contrato_status,
 * briefing_submitted_at, chamada_agendada_at). Sem novas colunas.
 *
 * Fluxo de vida do cliente, da esquerda pra direita:
 *
 *   1. Lead (sem contrato preenchido)
 *   2. Aguardando contrato (contrato preenchido, contrato_status != assinado)
 *   3. Aguardando chamada (contrato assinado, chamada não agendada)
 *   4. Briefing em progresso (chamada feita, briefing não submetido)
 *   5. Pronto pra produção (briefing submetido, current_stage_index == 0)
 *   6+. Etapas de produção (uma lane por etapa do project_type)
 *   N. Entregue (status = concluido)
 *   X. Abandonado / Não iniciado (status = abandonado | nao-iniciado)
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

/**
 * Lanes do KANBAN GERAL — independente de project_type, mostra o fluxo
 * comercial + produção em alto nível.
 */
export const GENERAL_LANES: Lane[] = [
  { id: "lead",             label: "LEAD",                tone: "slate",   description: "Cliente cadastrado, sem contrato preenchido" },
  { id: "contrato_aberto",  label: "AGUARDANDO CONTRATO", tone: "indigo",  description: "Dados de contrato enviados, esperando assinatura" },
  { id: "agendar_chamada",  label: "AGENDAR CHAMADA",     tone: "yellow",  description: "Contrato assinado, agendar onboarding" },
  { id: "briefing",         label: "BRIEFING",            tone: "pink",    description: "Cliente preenchendo briefing" },
  { id: "producao",         label: "EM PRODUÇÃO",         tone: "violet",  description: "Briefing OK, equipe trabalhando" },
  { id: "ajustes",          label: "AJUSTES",             tone: "amber",   description: "Iteração com cliente" },
  { id: "implementacao",    label: "IMPLEMENTAÇÃO",       tone: "orange",  description: "Publicação, pixel, otimização" },
  { id: "entregue",         label: "ENTREGUE",            tone: "emerald", description: "Projeto concluído" },
  { id: "parado",           label: "PARADO",              tone: "red",     description: "Sem atividade há +14d ou status = abandonado" },
];

/**
 * Mapeia um cliente para sua lane atual com base nos campos disponíveis.
 * Determinístico, sem efeitos colaterais.
 */
export function laneForClient(c: ClientForLane): string {
  // Abandonado / não iniciado vai pra parado
  if (c.status === "abandonado" || c.status === "nao-iniciado") return "parado";

  // Concluído vai pra entregue
  if (c.status === "concluido") return "entregue";

  // Parado por inatividade (>14d sem atividade e sem ter concluído)
  const ref = c.last_client_activity_at ?? c.created_at;
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
  const isStuck = days >= 14;

  // Fluxo comercial
  if (!c.contrato_preenchido_at) {
    return isStuck ? "parado" : "lead";
  }
  if (c.contrato_status !== "assinado") {
    return isStuck ? "parado" : "contrato_aberto";
  }
  if (!c.chamada_agendada_at) {
    return isStuck ? "parado" : "agendar_chamada";
  }
  if (!c.briefing_submitted_at) {
    return isStuck ? "parado" : "briefing";
  }

  // Produção — mapeia current_stage_index pra lanes específicas
  if (!c.project_type) return "producao";
  const stages = buildTimeline(c.project_type, c.current_stage_index ?? 0);
  const idx = Math.min(c.current_stage_index ?? 0, stages.length - 1);
  const stageName = stages[idx]?.titulo?.toLowerCase() ?? "";

  if (stageName.includes("entrega") || stageName.includes("documento")) {
    return "implementacao";
  }
  if (stageName.includes("implementa") || stageName.includes("otimiza")) {
    return "implementacao";
  }
  if (stageName.includes("ajuste")) return "ajustes";
  return "producao";
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

export function computeStats(clients: ClientForLane[]): ClientStats {
  const porLane = new Map<string, ClientForLane[]>();
  GENERAL_LANES.forEach((l) => porLane.set(l.id, []));
  const porTipo = new Map<string, number>();
  const porStatus = new Map<string, number>();
  let receitaTotal = 0;
  let receitaPaga = 0;
  const parados: ClientForLane[] = [];

  clients.forEach((c) => {
    const lane = laneForClient(c);
    porLane.get(lane)?.push(c);

    const tipo = c.project_type ?? "—";
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
    const st = c.status ?? "—";
    porStatus.set(st, (porStatus.get(st) ?? 0) + 1);

    if (c.pagamento_total) receitaTotal += Number(c.pagamento_total);
    if (c.pagamento_pago) receitaPaga += Number(c.pagamento_pago);

    if (lane === "parado") parados.push(c);
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
