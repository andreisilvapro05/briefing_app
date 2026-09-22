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
  | "em-andamento"
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
  "em-andamento": "ativo",
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
  { value: "em-andamento", label: "Em andamento" },
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
  "em-andamento": "bg-sky-50 text-sky-700 border-sky-200",
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

/**
 * Status oferecidos numa DEMANDA INTERNA (a que tem `area` e não tem
 * cliente).
 *
 * Os outros 11 são etapas de projeto de cliente — "Onboarding",
 * "Redação/Copy", "Design da página". Numa demanda como "realizar pagamento
 * da contabilidade" nenhum deles cabe, e por não caber a demanda ficava
 * parada em "A iniciar" mesmo depois de começada (Karine, 22/09). Uma lista
 * de 15 opções em que 11 são absurdas também não é uma escolha: é ruído.
 *
 * O valor gravado é o mesmo da taxonomia geral — muda só o que a tela
 * oferece. Demanda que já esteja num status de projeto continua mostrando
 * o dela, pra não sumir com o dado.
 */
export const TASK_STATUS_INTERNO: TaskStatus[] = [
  "a-iniciar",
  "em-andamento",
  "parado",
  "concluido",
];

/** Opções do select numa demanda interna, sem perder o valor atual. */
export function statusOptionsInternos(
  atual: string
): { value: TaskStatus; label: string }[] {
  const valores = new Set<string>(TASK_STATUS_INTERNO);
  if (atual) valores.add(atual);
  return TASK_STATUS_OPTIONS.filter((o) => valores.has(o.value));
}

/**
 * Matriz de Eisenhower — urgente × importante.
 *
 * Pedido da Karine (2026-09-22). Não substitui `prioridade`, que é a
 * bandeira do ClickUp e é um eixo só: aqui a pergunta não é "o que vem
 * primeiro" e sim "isso é pra fazer, planejar, delegar ou apagar".
 * "Responder e-mail" costuma ser urgente E não importante ao mesmo tempo —
 * é esse cruzamento que a matriz serve pra deixar visível.
 *
 * `urgente` e `importante` ficam guardados porque a tela desenha a matriz
 * 2×2 de verdade: escolher numa grade é mais rápido e mais fiel do que ler
 * quatro rótulos numa lista.
 */
export interface Quadrante {
  value: string;
  label: string;
  /** O que fazer com uma tarefa desse quadrante. */
  acao: string;
  urgente: boolean;
  importante: boolean;
  tom: string;
  /** Cor do pontinho na linha da tarefa. */
  ponto: string;
}

export const EISENHOWER: Quadrante[] = [
  {
    value: "fazer",
    label: "Fazer agora",
    acao: "Crise, prazo estourando, o que não pode esperar",
    urgente: true,
    importante: true,
    tom: "bg-red-50 text-red-800 border-red-200",
    ponto: "bg-red-500",
  },
  {
    value: "planejar",
    label: "Planejar",
    acao: "Importante e sem pressa — é aqui que o trabalho bom acontece",
    urgente: false,
    importante: true,
    tom: "bg-emerald-50 text-emerald-800 border-emerald-200",
    ponto: "bg-emerald-500",
  },
  {
    value: "delegar",
    label: "Delegar",
    acao: "Pressiona mas não precisa ser você — passe adiante",
    urgente: true,
    importante: false,
    tom: "bg-amber-50 text-amber-800 border-amber-200",
    ponto: "bg-amber-500",
  },
  {
    value: "eliminar",
    label: "Eliminar",
    acao: "Nem urgente nem importante — tire da lista",
    urgente: false,
    importante: false,
    tom: "bg-fysi-cream text-fysi-muted border-fysi-line",
    ponto: "bg-fysi-line-strong",
  },
];

export const EISENHOWER_VALUES: string[] = EISENHOWER.map((q) => q.value);

export function quadranteDe(v: string | null | undefined): Quadrante | null {
  if (!v) return null;
  return EISENHOWER.find((q) => q.value === v) ?? null;
}

/**
 * Tamanho da tarefa — "o que é rápido e demorado de fazer" (Karine).
 *
 * Eixo diferente de prioridade e de quadrante: serve pra escolher o que dá
 * pra fechar AGORA, no vão entre duas reuniões. Hoje uma tarefa de cinco
 * minutos e uma de um dia inteiro têm exatamente a mesma cara na lista.
 */
export interface Esforco {
  value: string;
  label: string;
  /** Rótulo curto pro chip da linha. */
  curto: string;
  tom: string;
}

export const ESFORCOS: Esforco[] = [
  {
    value: "rapido",
    label: "Rápido — até 5 minutos",
    curto: "5 min",
    tom: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    value: "curto",
    label: "Curto — até 30 minutos",
    curto: "30 min",
    tom: "bg-sky-50 text-sky-800 border-sky-200",
  },
  {
    value: "medio",
    label: "Médio — algumas horas",
    curto: "horas",
    tom: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    value: "longo",
    label: "Longo — um dia ou mais",
    curto: "1 dia+",
    tom: "bg-violet-50 text-violet-800 border-violet-200",
  },
];

export const ESFORCO_VALUES: string[] = ESFORCOS.map((e) => e.value);

export function esforcoDe(v: string | null | undefined): Esforco | null {
  if (!v) return null;
  return ESFORCOS.find((e) => e.value === v) ?? null;
}

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
  /**
   * Freelancer/parceiro: recebe demanda, mas não é da equipe interna.
   * Aparece marcado como externo em vez de sumir — antes, tarefa atribuída
   * a ele no ClickUp virava tarefa sem dono aqui.
   */
  externo?: boolean;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { value: "taina", label: "Tainá", iniciais: "T", cor: "bg-amber-500" },
  { value: "valeria", label: "Valéria", iniciais: "VN", cor: "bg-pink-500" },
  { value: "karine", label: "Karine", iniciais: "KS", cor: "bg-violet-500" },
  { value: "andrei", label: "Andrei", iniciais: "A", cor: "bg-indigo-500" },
  // Implementação das páginas (papel "desenvolvedor" em team_members, ver
  // lib/member.ts). Precisa estar aqui pra a equipe poder ATRIBUIR tarefa a
  // ele: `responsavel` guarda este `value`, e é dele que saem tanto a lista
  // de /admin/desenvolvimento quanto o escopo de clientes que ele enxerga.
  { value: "daniel", label: "Daniel", iniciais: "D", cor: "bg-teal-600" },
  // Externo: está no workspace do ClickUp, não é equipe interna.
  {
    value: "leonardo",
    label: "Leonardo",
    iniciais: "L",
    cor: "bg-slate-500",
    externo: true,
  },
];

/** Só a equipe interna — pra telas que não devem oferecer freelancer. */
export const TEAM_MEMBERS_INTERNOS: TeamMember[] = TEAM_MEMBERS.filter(
  (m) => !m.externo
);

export function ehExterno(responsavel: string | null | undefined): boolean {
  if (!responsavel) return false;
  return Boolean(TEAM_MEMBERS.find((m) => m.value === responsavel)?.externo);
}

/**
 * Áreas internas da agência — o trabalho que NÃO pertence a um cliente.
 *
 * Pedido da Karine (2026-09-21): a Tainá recebe demandas que chegam pra ela
 * e não são de projeto nenhum ("revisar contrato padrão", "post da semana"),
 * e não havia onde colocá-las sem sujar a lista de um cliente.
 *
 * `cor` é a faixa do cartão na tela de Demandas; a área se reconhece de
 * relance pela cor, sem precisar ler.
 */
export interface Area {
  value: string;
  label: string;
  /** Classe de fundo+texto+borda da etiqueta. */
  tom: string;
  /** Classe de fundo da barra lateral do grupo. */
  barra: string;
}

export const AREAS: Area[] = [
  {
    value: "comercial",
    label: "Comercial",
    tom: "bg-emerald-50 text-emerald-800 border-emerald-200",
    barra: "bg-emerald-500",
  },
  {
    value: "atendimento",
    label: "Atendimento",
    tom: "bg-teal-50 text-teal-800 border-teal-200",
    barra: "bg-teal-500",
  },
  {
    value: "curso",
    label: "Curso",
    tom: "bg-violet-50 text-violet-800 border-violet-200",
    barra: "bg-violet-500",
  },
  {
    value: "financeiro",
    label: "Financeiro / Administrativo",
    tom: "bg-sky-50 text-sky-800 border-sky-200",
    barra: "bg-sky-500",
  },
  {
    value: "processos",
    label: "Processos",
    tom: "bg-amber-50 text-amber-800 border-amber-200",
    barra: "bg-amber-500",
  },
  {
    value: "marketing",
    label: "Marketing",
    tom: "bg-pink-50 text-pink-800 border-pink-200",
    barra: "bg-pink-500",
  },
];

export const AREA_VALUES: string[] = AREAS.map((a) => a.value);

export function areaDe(value: string | null | undefined): Area | null {
  if (!value) return null;
  return AREAS.find((a) => a.value === value) ?? null;
}

export function areaLabel(value: string | null | undefined): string {
  return areaDe(value)?.label ?? "Sem área";
}

export interface ProjectTask {
  id: string;
  /** null = demanda interna da agência, não ligada a nenhum cliente. */
  client_id: string | null;
  /** Área interna (ver AREAS). null = trabalho de projeto, de um cliente. */
  area: string | null;
  titulo: string;
  ordem: number;
  status: TaskStatus;
  prioridade: string | null;
  /** Quadrante da matriz de Eisenhower (ver EISENHOWER). null = não classificada. */
  eisenhower: string | null;
  /** Tamanho da tarefa (ver ESFORCOS). null = não estimada. */
  esforco: string | null;
  responsavel: string | null;
  data_inicial: string | null;
  data_vencimento: string | null;
  concluida_em: string | null;
  observacoes: string | null;
  origem: "template" | "manual" | "clickup";
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

/**
 * Dono padrão por TIPO de tarefa.
 *
 * Por que isso existe: em 2026-09-20 o app tinha 276 tarefas sem
 * responsável contra 61 com — "Meu trabalho" ficava vazio pra todo mundo.
 * Parte disso o ClickUp resolve (sync traz o assignee real), mas lá também
 * há etapa sem ninguém: "Design", "Implementação", "Ajustes" e "DEP" são
 * criadas em branco em todo projeto novo.
 *
 * Os padrões abaixo saem do que o ClickUp mostra de fato hoje:
 *   - "Copy LP": 18 de 18 tarefas são da Karine;
 *   - Design / Bgs / Ajustes: Valéria em todas as que têm dono;
 *   - Implementação / entrega: Andrei;
 *   - Contrato/Pagamento: Andrei (é o comercial).
 *
 * A Tainá NÃO está no workspace do ClickUp, então não há evidência pra
 * atribuir nada a ela automaticamente — as demandas dela precisam ser
 * marcadas no app.
 *
 * Só é aplicado a tarefa SEM responsável: nunca sobrescreve escolha da
 * equipe nem o que veio do ClickUp.
 */
export const DONO_PADRAO_POR_TAREFA: Record<string, string> = {
  // Decisão da Karine em 2026-09-21: a coleta de informação inicial com o
  // cliente é da Tainá. Como ela não está no ClickUp, essa demanda nunca vem
  // de lá — só é atribuída aqui.
  "Informações Iniciais": "taina",
  "Copy LP": "karine",
  "Copy do site": "karine",
  Design: "valeria",
  "Design (múltiplas páginas)": "valeria",
  "Criação Assets/BGs": "valeria",
  "Ajustes v1": "valeria",
  "Ajustes v2": "valeria",
  "Ajustes v3": "valeria",
  Implementação: "andrei",
  "DEP + Otimização": "andrei",
  "Envio Contrato": "andrei",
  Pagamento: "andrei",
};

/** Dono padrão de um título, tolerante a variação ("Copy LP Laurence"). */
export function donoPadraoDe(titulo: string): string | null {
  const t = titulo.trim();
  if (DONO_PADRAO_POR_TAREFA[t]) return DONO_PADRAO_POR_TAREFA[t];
  const baixo = t.toLowerCase();
  if (/^copy\b/.test(baixo)) return "karine";
  if (/^(design|criação assets|criacao assets|bgs|ajustes)\b/.test(baixo))
    return "valeria";
  if (/^(implementa|dep\b|otimiza)/.test(baixo)) return "andrei";
  if (/^informa[çc][õo]es iniciais/.test(baixo)) return "taina";
  return null;
}
