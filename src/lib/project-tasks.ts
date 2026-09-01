import type { ProjectType } from "./types";

/**
 * Tarefas internas de produção por projeto (cliente). Template por tipo de
 * projeto vive em código (DEFAULT_PROJECT_TASKS) — as linhas instanciadas
 * ficam na tabela `project_tasks`. Ver spec:
 * docs/superpowers/specs/2026-07-06-caixa-2-tarefas-clickup-design.md
 */

/**
 * Taxonomia completa de status — mesma usada pelo ClickUp da equipe hoje
 * (confirmado via prints em 2026-08-29). Se dividem em 2 grupos
 * (TASK_STATUS_GROUP): "ativo" (em andamento, em qualquer estágio) e
 * "fechado" (terminal — hoje só "Completo | Entregue"). O grupo controla
 * `concluida_em` e se a data de vencimento é destacada como atrasada.
 */
export type TaskStatus =
  | "parado"
  | "nem-comecou-nada"
  | "a-iniciar"
  | "onboarding"
  | "envio-informacoes"
  | "redacao-copy"
  | "design-pagina"
  | "validacao-design-copy"
  | "ajustes-design-copy"
  | "implementacao"
  | "validacao-implementacao"
  | "ajuste-implementacao"
  | "otimizacao-entrega"
  | "concluido"
  | "completo-entregue";

export type TaskStatusGroup = "ativo" | "fechado";

export const TASK_STATUS_GROUP: Record<TaskStatus, TaskStatusGroup> = {
  parado: "ativo",
  "nem-comecou-nada": "ativo",
  "a-iniciar": "ativo",
  onboarding: "ativo",
  "envio-informacoes": "ativo",
  "redacao-copy": "ativo",
  "design-pagina": "ativo",
  "validacao-design-copy": "ativo",
  "ajustes-design-copy": "ativo",
  implementacao: "ativo",
  "validacao-implementacao": "ativo",
  "ajuste-implementacao": "ativo",
  "otimizacao-entrega": "ativo",
  concluido: "fechado",
  "completo-entregue": "fechado",
};

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "parado", label: "Parado" },
  { value: "nem-comecou-nada", label: "Nem começou nada" },
  { value: "a-iniciar", label: "A iniciar" },
  { value: "onboarding", label: "Onboarding" },
  { value: "envio-informacoes", label: "Envio de informações" },
  { value: "redacao-copy", label: "Redação/Copy" },
  { value: "design-pagina", label: "Design da página" },
  { value: "validacao-design-copy", label: "Validação Design+Copy" },
  { value: "ajustes-design-copy", label: "Ajustes Design/Copy" },
  { value: "implementacao", label: "Implementação" },
  { value: "validacao-implementacao", label: "Validação Implementação" },
  { value: "ajuste-implementacao", label: "Ajuste Implementação" },
  { value: "otimizacao-entrega", label: "Otimização+Entrega" },
  { value: "concluido", label: "Concluído" },
  { value: "completo-entregue", label: "Completo | Entregue" },
];

export const TASK_STATUS_VALUES: TaskStatus[] = TASK_STATUS_OPTIONS.map(
  (o) => o.value
);

/** Status default pra cliente/tarefa sem valor definido — mesmo default da coluna `clients.status`. */
export const DEFAULT_TASK_STATUS: TaskStatus = "a-iniciar";

export function isActiveTaskStatus(status: TaskStatus): boolean {
  return TASK_STATUS_GROUP[status] === "ativo";
}

export function isClosedTaskStatus(status: TaskStatus): boolean {
  return TASK_STATUS_GROUP[status] === "fechado";
}

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  parado: "bg-red-50 text-red-700 border-red-200",
  "nem-comecou-nada": "bg-fysi-cream text-fysi-muted border-fysi-line",
  "a-iniciar": "bg-white text-fysi-deep border-fysi-line",
  onboarding: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "envio-informacoes": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "redacao-copy": "bg-pink-50 text-pink-700 border-pink-200",
  "design-pagina": "bg-violet-50 text-violet-700 border-violet-200",
  "validacao-design-copy": "bg-red-50 text-red-700 border-red-200",
  "ajustes-design-copy": "bg-amber-50 text-amber-700 border-amber-200",
  implementacao: "bg-orange-50 text-orange-700 border-orange-200",
  "validacao-implementacao": "bg-red-50 text-red-700 border-red-200",
  "ajuste-implementacao": "bg-amber-50 text-amber-700 border-amber-200",
  "otimizacao-entrega": "bg-orange-50 text-orange-700 border-orange-200",
  concluido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "completo-entregue": "bg-fysi-mint/40 text-fysi-deep border-fysi-mint/60",
};

/** Vazio ("") = sem prioridade — vira `null` no banco. */
export const TASK_PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Sem prioridade" },
  { value: "urgente", label: "Urgente" },
  { value: "alta", label: "Alta" },
  { value: "normal", label: "Normal" },
  { value: "baixa", label: "Baixa" },
];

/**
 * Equipe Fysi — lista fixa em código (não é tabela; login individual por
 * pessoa foi adiado, ver spec caixa-0-membros-papeis). `value` é o que fica
 * gravado em `project_tasks.responsavel` — estável mesmo se o `label` mudar.
 */
export interface TeamMember {
  value: string;
  label: string;
  iniciais: string;
  cor: string; // classe Tailwind de fundo do avatar
}

export const TEAM_MEMBERS: TeamMember[] = [
  { value: "taina", label: "Tainá", iniciais: "T", cor: "bg-amber-500" },
  { value: "valeria", label: "Valéria", iniciais: "VN", cor: "bg-pink-500" },
  { value: "karine", label: "Karine", iniciais: "KS", cor: "bg-violet-500" },
  { value: "andrei", label: "Andrei", iniciais: "A", cor: "bg-indigo-500" },
];

export interface ProjectTask {
  id: string;
  client_id: string;
  titulo: string;
  ordem: number;
  status: TaskStatus;
  prioridade: string | null;
  responsavel: string | null;
  data_inicial: string | null;
  data_vencimento: string | null;
  concluida_em: string | null;
  observacoes: string | null;
  origem: "template" | "manual";
  created_at: string;
  updated_at: string;
}

/**
 * Templates por tipo de projeto. Confirmados via exemplos reais (Katlyn Adv =
 * landing-com-copy, César = landing-sem-copy); site-completo/seo/outro são
 * extrapolação — ajustável aqui sem migration. Ver spec §9 (addendum).
 *
 * Envio Contrato/Pagamento abrem todo projeto (etapa comercial antes da
 * produção). Ajustes vira 3 levas (v1/v2/v3 no Figma) seguidas de Criação
 * Assets/BGs — pedido do usuário em 2026-09-01, com base no fluxo real de
 * produção da agência.
 */
export const DEFAULT_PROJECT_TASKS: Record<ProjectType, string[]> = {
  "landing-com-copy": [
    "Envio Contrato",
    "Pagamento",
    "Copy LP",
    "Informações Iniciais",
    "Design",
    "Ajustes v1",
    "Ajustes v2",
    "Ajustes v3",
    "Criação Assets/BGs",
    "Implementação",
    "DEP + Otimização",
  ],
  "landing-sem-copy": [
    "Envio Contrato",
    "Pagamento",
    "Informações Iniciais",
    "Design",
    "Ajustes v1",
    "Ajustes v2",
    "Ajustes v3",
    "Criação Assets/BGs",
    "Implementação",
    "DEP + Otimização",
  ],
  "site-completo": [
    "Envio Contrato",
    "Pagamento",
    "Copy do site",
    "Informações Iniciais",
    "Design (múltiplas páginas)",
    "Ajustes v1",
    "Ajustes v2",
    "Ajustes v3",
    "Criação Assets/BGs",
    "Implementação",
    "DEP + Otimização",
  ],
  seo: [
    "Envio Contrato",
    "Pagamento",
    "Auditoria SEO",
    "Estratégia e plano de ação",
    "Otimização on-page",
    "Conteúdo e link building",
    "Relatório e monitoramento",
  ],
  outro: ["Envio Contrato", "Pagamento", "Planejamento", "Execução", "Entrega"],
};
