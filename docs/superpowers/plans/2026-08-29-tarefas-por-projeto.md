# Tarefas por Projeto (Caixa 2 — núcleo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada cliente/projeto um checklist de subtarefas (nome, status, prioridade, responsável, datas) gerado a partir de um template por tipo de projeto, editável numa aba nova "Tarefas" na ficha do cliente (`/admin/[id]`).

**Architecture:** Tabela relacional nova `project_tasks` (uma linha por subtarefa, ligada a `clients.id`). Templates de tarefas por `project_type` vivem em código (não em DB), no mesmo espírito de `PROJECT_TYPE_OPTIONS`/`buildTimeline` já existentes em `src/lib/project-types.ts`. Um botão "Gerar tarefas do template" instancia as linhas; depois disso o admin edita cada uma inline (status/prioridade/responsável/datas via `<select>`/`<input>` com server actions, otimista, mesmo padrão de `StatusChanger`/`CustomQuestionsEditor` já usados no repo). "Responsável" é uma lista fixa de 4 nomes em código (Tainá, Valéria, Karine, Andrei) — não uma tabela nova nem login (essa parte foi explicitamente adiada).

**Tech Stack:** Next.js 16 App Router (server actions, `force-dynamic`), React 19, Supabase Postgres (client `service-role`, sem RLS pública), Tailwind 4, TypeScript estrito.

**Spec:** `docs/superpowers/specs/2026-07-06-caixa-2-tarefas-clickup-design.md` (seções 1-4, 6 e o Addendum §9 de 2026-08-29 — que é quem resolve os templates e o escopo exatos deste plano). Este plano implementa só o **núcleo** (passos 1-4 da §8 original da spec); autofill de EI e espelho ClickUp (passos 5-6) ficam de fora.

**Status das tarefas (confirmado em 2026-08-29, via prints do ClickUp em uso pela equipe):** cada subtarefa usa a MESMA taxonomia de ~13 status que o projeto (não um enum simples de 4 valores) — ver lista completa no Task 1. Os status se dividem em 2 grupos: **Ativo** (12 status, do "Parado" ao "Otimização+Entrega") e **Fechado** (1 status: "Completo | Entregue"). O grupo controla dois comportamentos: (a) uma tarefa em status do grupo Fechado tem `concluida_em` preenchido automaticamente e (b) sua data de vencimento **para de ser destacada como atrasada** na UI. Fechar **não é** arquivar — não existe ação de arquivamento nesta rodada (fora de escopo; se pedirem depois, é uma coluna nova, não muda o que já existe). Tarefas em status do grupo Fechado ficam **recolhidas por padrão** atrás de um toggle "Mostrar N Fechados" (mesmo padrão visto no ClickUp da equipe).

## Global Constraints

- **Sem framework de testes no repo** (nenhum `vitest`/`jest`, `package.json` não tem script `test`). Os passos abaixo usam verificação manual (type-check via `npx tsc --noEmit`, checagem no app rodando com `npm run dev`, e/ou consulta SQL) em vez de testes automatizados — isso segue a convenção já existente no repo, não é uma omissão.
- Toda migration é **idempotente** (`create table if not exists`, `drop trigger if exists` antes de recriar) — convenção de todas as migrations existentes em `supabase/migrations/`.
- Toda tabela nova tem RLS habilitada **sem policy pública** — só o cliente `service-role` (usado no backend) lê/escreve, bypassando RLS. Mesmo padrão de `admin_notifications`/`client_custom_questions`.
- Toda server action segue o padrão já usado em `src/app/admin/[id]/actions.ts`: recebe `FormData`, resolve `urlKey` de `formData.get("key")`, chama `getAdminUser({ urlKey})` e faz `redirect("/admin/login")` se não autenticado, usa `createSupabaseServiceRoleClient()`, termina com `revalidatePath(...)`.
- Client components de edição inline seguem o padrão de `src/components/admin/status-changer.tsx` (select colorido + `useTransition` + estado local otimista) e `src/components/admin/custom-questions-editor.tsx` (lista com adicionar/remover via `FormData` manual).
- Cores/classes seguem os tokens Tailwind já definidos (`fysi-deep`, `fysi-cream`, `fysi-mint`, `fysi-line`, `fysi-muted`) — não introduzir cores novas fora da paleta.

---

### Task 1: Templates e tipos compartilhados (`project-tasks.ts`)

**Files:**
- Create: `src/lib/project-tasks.ts`

**Interfaces:**
- Produces: `TaskStatus` (union type), `TASK_STATUS_OPTIONS`, `TASK_STATUS_TONE`, `TASK_PRIORITY_OPTIONS`, `TEAM_MEMBERS` (com `{ value, label, iniciais, cor }`), `ProjectTask` interface, `DEFAULT_PROJECT_TASKS: Record<ProjectType, string[]>`. Todas as tasks seguintes importam deste arquivo.
- Consumes: `ProjectType` de `@/lib/types` (já existe, não muda).

Este arquivo é **client-safe** (sem import de Supabase/server) — pode ser importado tanto por server components/actions quanto por client components, mesmo padrão de `src/lib/custom-questions.ts`.

- [ ] **Step 1: Criar o arquivo com os tipos e constantes**

```ts
// src/lib/project-tasks.ts
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
  | "redacao-copy"
  | "design-pagina"
  | "validacao-design-copy"
  | "ajustes-design-copy"
  | "implementacao"
  | "validacao-implementacao"
  | "ajuste-implementacao"
  | "otimizacao-entrega"
  | "completo-entregue";

export type TaskStatusGroup = "ativo" | "fechado";

export const TASK_STATUS_GROUP: Record<TaskStatus, TaskStatusGroup> = {
  parado: "ativo",
  "nem-comecou-nada": "ativo",
  "a-iniciar": "ativo",
  onboarding: "ativo",
  "redacao-copy": "ativo",
  "design-pagina": "ativo",
  "validacao-design-copy": "ativo",
  "ajustes-design-copy": "ativo",
  implementacao: "ativo",
  "validacao-implementacao": "ativo",
  "ajuste-implementacao": "ativo",
  "otimizacao-entrega": "ativo",
  "completo-entregue": "fechado",
};

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "parado", label: "Parado" },
  { value: "nem-comecou-nada", label: "Nem começou nada" },
  { value: "a-iniciar", label: "A iniciar" },
  { value: "onboarding", label: "Onboarding" },
  { value: "redacao-copy", label: "Redação/Copy" },
  { value: "design-pagina", label: "Design da página" },
  { value: "validacao-design-copy", label: "Validação Design+Copy" },
  { value: "ajustes-design-copy", label: "Ajustes Design/Copy" },
  { value: "implementacao", label: "Implementação" },
  { value: "validacao-implementacao", label: "Validação Implementação" },
  { value: "ajuste-implementacao", label: "Ajuste Implementação" },
  { value: "otimizacao-entrega", label: "Otimização+Entrega" },
  { value: "completo-entregue", label: "Completo | Entregue" },
];

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  parado: "bg-red-50 text-red-700 border-red-200",
  "nem-comecou-nada": "bg-fysi-cream text-fysi-muted border-fysi-line",
  "a-iniciar": "bg-fysi-cream text-fysi-muted border-fysi-line",
  onboarding: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "redacao-copy": "bg-pink-50 text-pink-700 border-pink-200",
  "design-pagina": "bg-violet-50 text-violet-700 border-violet-200",
  "validacao-design-copy": "bg-red-50 text-red-700 border-red-200",
  "ajustes-design-copy": "bg-amber-50 text-amber-700 border-amber-200",
  implementacao: "bg-orange-50 text-orange-700 border-orange-200",
  "validacao-implementacao": "bg-red-50 text-red-700 border-red-200",
  "ajuste-implementacao": "bg-amber-50 text-amber-700 border-amber-200",
  "otimizacao-entrega": "bg-orange-50 text-orange-700 border-orange-200",
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
  { value: "taina", label: "Tainá", iniciais: "TN", cor: "bg-amber-500" },
  { value: "valeria", label: "Valéria", iniciais: "VL", cor: "bg-pink-500" },
  { value: "karine", label: "Karine", iniciais: "KR", cor: "bg-violet-500" },
  { value: "andrei", label: "Andrei", iniciais: "AN", cor: "bg-indigo-500" },
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
  origem: "template" | "manual";
  created_at: string;
  updated_at: string;
}

/**
 * Templates por tipo de projeto. Confirmados via exemplos reais (Katlyn Adv =
 * landing-com-copy, César = landing-sem-copy); site-completo/seo/outro são
 * extrapolação — ajustável aqui sem migration. Ver spec §9 (addendum).
 */
export const DEFAULT_PROJECT_TASKS: Record<ProjectType, string[]> = {
  "landing-com-copy": [
    "Copy LP",
    "Informações Iniciais",
    "Design",
    "Ajustes",
    "Implementação",
    "DEP + Otimização",
  ],
  "landing-sem-copy": [
    "Informações Iniciais",
    "Design",
    "Ajustes",
    "Implementação",
    "DEP + Otimização",
  ],
  "site-completo": [
    "Copy do site",
    "Informações Iniciais",
    "Design (múltiplas páginas)",
    "Ajustes",
    "Implementação",
    "DEP + Otimização",
  ],
  seo: [
    "Auditoria SEO",
    "Estratégia e plano de ação",
    "Otimização on-page",
    "Conteúdo e link building",
    "Relatório e monitoramento",
  ],
  outro: ["Planejamento", "Execução", "Entrega"],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `project-tasks.ts` (o arquivo ainda não é importado por ninguém, então só valida sintaxe/tipos internos).

- [ ] **Step 3: Commit**

```bash
git add src/lib/project-tasks.ts
git commit -m "feat(tarefas): templates e tipos de project_tasks"
```

---

### Task 2: Migration `project_tasks`

**Files:**
- Create: `supabase/migrations/20260829120000_add_project_tasks.sql`

**Interfaces:**
- Consumes: `public.touch_updated_at()` (função já existe, criada em `20260430000000_initial_schema.sql`), `public.clients(id)`.
- Produces: tabela `public.project_tasks` com colunas `id, client_id, titulo, ordem, status, prioridade, responsavel, data_inicial, data_vencimento, concluida_em, origem, created_at, updated_at` — é o que os Tasks 3-5 leem/escrevem.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- project_tasks — tarefas internas de produção por projeto (cliente).
-- Instanciadas a partir de DEFAULT_PROJECT_TASKS (src/lib/project-tasks.ts)
-- quando o admin clica "Gerar tarefas do template". Fonte de verdade das
-- subtarefas internas — não visível ao cliente.
-- Ver docs/superpowers/specs/2026-07-06-caixa-2-tarefas-clickup-design.md
-- ============================================================
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,

  titulo text not null,
  ordem int not null default 0,

  status text not null default 'a-iniciar'
    check (status in (
      'parado', 'nem-comecou-nada', 'a-iniciar', 'onboarding',
      'redacao-copy', 'design-pagina', 'validacao-design-copy',
      'ajustes-design-copy', 'implementacao', 'validacao-implementacao',
      'ajuste-implementacao', 'otimizacao-entrega', 'completo-entregue'
    )),
  prioridade text
    check (prioridade is null or prioridade in ('urgente', 'alta', 'normal', 'baixa')),
  responsavel text,

  data_inicial date,
  data_vencimento date,
  concluida_em timestamptz,

  origem text not null default 'template'
    check (origem in ('template', 'manual')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_client_idx
  on public.project_tasks(client_id);
create index if not exists project_tasks_status_idx
  on public.project_tasks(status);

drop trigger if exists project_tasks_touch_updated_at on public.project_tasks;
create trigger project_tasks_touch_updated_at
  before update on public.project_tasks
  for each row execute function public.touch_updated_at();

-- RLS: só o service_role (backend) lê/escreve — sem policy pública, nega
-- tudo pra anon/authenticated. Cliente nunca vê tarefas internas.
alter table public.project_tasks enable row level security;

comment on table public.project_tasks is
  'Subtarefas internas de produção por cliente/projeto, geradas de um template por project_type. Ver Caixa 2.';
```

- [ ] **Step 2: Verificar manualmente**

Se houver Supabase local (`supabase start`) ou acesso ao SQL Editor do projeto: rode o arquivo e confira que a tabela aparece em "Database → Tables" com as colunas acima. Se não houver ambiente disponível agora, isso é validado no Task 5 (a UI só funciona se a tabela existir) — rodar a migration antes de testar o Task 5 é obrigatório.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260829120000_add_project_tasks.sql
git commit -m "feat(tarefas): migration da tabela project_tasks"
```

---

### Task 3: Data layer server-only + server actions

**Files:**
- Create: `src/lib/project-tasks-server.ts`
- Modify: `src/app/admin/[id]/actions.ts` (adicionar ao final do arquivo)

**Interfaces:**
- Consumes: `ProjectTask`, `DEFAULT_PROJECT_TASKS`, `TASK_STATUS_OPTIONS`, `TASK_PRIORITY_OPTIONS`, `TEAM_MEMBERS` de `@/lib/project-tasks` (Task 1); `createSupabaseServiceRoleClient` de `@/lib/supabase/server`; `getAdminUser` de `@/lib/admin`; tabela `project_tasks` (Task 2).
- Produces: `listProjectTasks(clientId): Promise<ProjectTask[]>` (usado no Task 5, dentro de `admin/[id]/page.tsx`); server actions `seedProjectTasksAction`, `addProjectTaskAction`, `removeProjectTaskAction`, `updateProjectTaskAction` (todas recebem `FormData`, usadas pelo componente do Task 5).

- [ ] **Step 1: Criar `project-tasks-server.ts`**

```ts
// src/lib/project-tasks-server.ts
import { createSupabaseServiceRoleClient } from "./supabase/server";
import type { ProjectTask, TaskStatus } from "./project-tasks";

/**
 * Leitura server-only das tarefas de um cliente (usa service-role). Separado
 * de project-tasks.ts pra não arrastar o cliente Supabase server pro bundle
 * de client components — mesmo padrão de custom-questions-server.ts.
 */
function normalizeTask(row: Record<string, unknown>): ProjectTask {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    titulo: String(row.titulo ?? ""),
    ordem: Number(row.ordem ?? 0),
    status: (row.status as TaskStatus) ?? "a-iniciar",
    prioridade: (row.prioridade as string | null) ?? null,
    responsavel: (row.responsavel as string | null) ?? null,
    data_inicial: (row.data_inicial as string | null) ?? null,
    data_vencimento: (row.data_vencimento as string | null) ?? null,
    concluida_em: (row.concluida_em as string | null) ?? null,
    origem: row.origem === "manual" ? "manual" : "template",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listProjectTasks(
  clientId: string
): Promise<ProjectTask[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeTask);
}
```

- [ ] **Step 2: Adicionar as server actions em `src/app/admin/[id]/actions.ts`**

No topo do arquivo, junto dos outros imports (perto de `import type { EIData } from "@/lib/ei-template";`), adicionar:

```ts
import {
  DEFAULT_PROJECT_TASKS,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_GROUP,
  TASK_PRIORITY_OPTIONS,
  TEAM_MEMBERS,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectType } from "@/lib/types";
```

No final do arquivo (depois de `deleteCustomQuestionAction`), adicionar:

```ts
const TASK_STATUS_VALUES = TASK_STATUS_OPTIONS.map((o) => o.value);
const TASK_PRIORITY_VALUES = TASK_PRIORITY_OPTIONS.map((o) => o.value).filter(
  Boolean
);
const TEAM_MEMBER_VALUES = TEAM_MEMBERS.map((m) => m.value);

/**
 * Gera as tarefas do template a partir do project_type do cliente.
 * Idempotente: não faz nada se já houver alguma tarefa (evita duplicar
 * se o admin clicar duas vezes ou o tipo mudar depois).
 */
export async function seedProjectTasksAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();

  const { data: client } = await service
    .from("clients")
    .select("project_type")
    .eq("id", clientId)
    .maybeSingle();
  const projectType = (
    client as { project_type: ProjectType | null } | null
  )?.project_type;
  if (!projectType) return;

  const { count } = await service
    .from("project_tasks")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  if ((count ?? 0) > 0) return;

  const titulos = DEFAULT_PROJECT_TASKS[projectType] ?? [];
  if (titulos.length === 0) return;

  await service.from("project_tasks").insert(
    titulos.map((titulo, i) => ({
      client_id: clientId,
      titulo,
      ordem: i,
      origem: "template" as const,
    }))
  );

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Adiciona uma tarefa ad-hoc (fora do template) ao final da lista do cliente.
 */
export async function addProjectTaskAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!clientId || !titulo) return;

  const service = createSupabaseServiceRoleClient();
  const { data: maxRow } = await service
    .from("project_tasks")
    .select("ordem")
    .eq("client_id", clientId)
    .order("ordem", { ascending: false })
    .limit(1);
  const nextOrdem =
    (Array.isArray(maxRow) && maxRow.length
      ? Number((maxRow[0] as { ordem: number }).ordem ?? -1)
      : -1) + 1;

  await service.from("project_tasks").insert({
    client_id: clientId,
    titulo,
    ordem: nextOrdem,
    origem: "manual",
  });

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Remove uma tarefa.
 */
export async function removeProjectTaskAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const taskId = String(formData.get("taskId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!taskId) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("project_tasks").delete().eq("id", taskId);

  if (clientId) revalidatePath(`/admin/${clientId}`);
}

/**
 * Atualização parcial de uma tarefa — só grava os campos presentes no
 * FormData (mesmo padrão de setClientContractDataAction). Usado pra editar
 * status/prioridade/responsável/datas inline, um de cada vez.
 */
export async function updateProjectTaskAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const taskId = String(formData.get("taskId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!taskId) return;

  const update: Record<string, unknown> = {};

  if (formData.has("status")) {
    const status = String(formData.get("status") ?? "");
    if (!TASK_STATUS_VALUES.includes(status as TaskStatus)) return;
    update.status = status;
    // Grupo "fechado" (hoje só "completo-entregue") marca concluida_em e é
    // o que faz a data de vencimento parar de ser destacada como atrasada
    // na UI (ver TaskRow no Task 5). Fechar != arquivar — não existe
    // arquivamento nesta rodada.
    update.concluida_em =
      TASK_STATUS_GROUP[status as TaskStatus] === "fechado"
        ? new Date().toISOString()
        : null;
  }

  if (formData.has("prioridade")) {
    const prioridade = String(formData.get("prioridade") ?? "");
    if (prioridade && !TASK_PRIORITY_VALUES.includes(prioridade)) return;
    update.prioridade = prioridade || null;
  }

  if (formData.has("responsavel")) {
    const responsavel = String(formData.get("responsavel") ?? "");
    if (responsavel && !TEAM_MEMBER_VALUES.includes(responsavel)) return;
    update.responsavel = responsavel || null;
  }

  if (formData.has("dataInicial")) {
    update.data_inicial = String(formData.get("dataInicial") ?? "").trim() || null;
  }

  if (formData.has("dataVencimento")) {
    update.data_vencimento =
      String(formData.get("dataVencimento") ?? "").trim() || null;
  }

  if (Object.keys(update).length === 0) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("project_tasks").update(update).eq("id", taskId);

  if (clientId) revalidatePath(`/admin/${clientId}`);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `project-tasks-server.ts` nem em `actions.ts`. Se aparecer erro de tipo em `TASK_STATUS_VALUES.includes(status as TaskStatus)`, confirme que `TaskStatus` foi importado como `type` (import type) no topo do `actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/project-tasks-server.ts src/app/admin/[id]/actions.ts
git commit -m "feat(tarefas): server actions de project_tasks"
```

---

### Task 4: Aba "Tarefas" no `ClientTabs`

**Files:**
- Modify: `src/components/admin/client-tabs.tsx`
- Modify: `src/app/admin/[id]/page.tsx:78-88` (array `validTabs`)

**Interfaces:**
- Consumes: nada novo.
- Produces: `ClientTab` passa a incluir `"tarefas"`; usado pelo Task 5 (`admin/[id]/page.tsx` já precisa reconhecer a aba antes de renderizar o board).

- [ ] **Step 1: Adicionar `"tarefas"` ao tipo e à lista de abas em `client-tabs.tsx`**

Em `src/components/admin/client-tabs.tsx`, mudar:

```ts
export type ClientTab =
  | "geral"
  | "ei"
  | "briefing"
  | "contrato"
  | "pagamentos"
  | "entrega"
  | "problemas"
  | "drive"
  | "moodboard";
```

para:

```ts
export type ClientTab =
  | "geral"
  | "ei"
  | "briefing"
  | "tarefas"
  | "contrato"
  | "pagamentos"
  | "entrega"
  | "problemas"
  | "drive"
  | "moodboard";
```

Na constante `TABS`, adicionar a entrada logo depois de `briefing` (mesma ordem usada acima):

```ts
const TABS: TabDef[] = [
  { id: "geral", label: "Visão geral" },
  { id: "ei", label: "EI · Estrutura inicial" },
  { id: "briefing", label: "Briefing" },
  { id: "tarefas", label: "Tarefas" },
  { id: "contrato", label: "Contrato" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "entrega", label: "DEP · Entrega" },
  { id: "problemas", label: "Problemas" },
  { id: "drive", label: "Drive" },
  { id: "moodboard", label: "Moodboard" },
];
```

No objeto `ICONS`, adicionar a entrada `tarefas` (ícone de checklist, mesmo estilo `<I>` das outras):

```ts
  tarefas: (
    <I>
      <rect x="3" y="5" width="4" height="4" rx="1" />
      <path d="M9 7h12" />
      <rect x="3" y="15" width="4" height="4" rx="1" />
      <path d="M9 17h12" />
    </I>
  ),
```

- [ ] **Step 2: Adicionar `"tarefas"` a `validTabs` em `admin/[id]/page.tsx`**

Mudar (linhas 78-88):

```ts
  const validTabs: ClientTab[] = [
    "geral",
    "ei",
    "briefing",
    "contrato",
    "pagamentos",
    "entrega",
    "problemas",
    "drive",
    "moodboard",
  ];
```

para:

```ts
  const validTabs: ClientTab[] = [
    "geral",
    "ei",
    "briefing",
    "tarefas",
    "contrato",
    "pagamentos",
    "entrega",
    "problemas",
    "drive",
    "moodboard",
  ];
```

- [ ] **Step 3: Verificar manualmente**

Com `npm run dev` rodando e um `clientId` real: abrir `/admin/[id]?tab=tarefas&key=<senha>`. A aba "Tarefas" deve aparecer destacada na navegação lateral (`ClientTabs`) e a página não deve quebrar — como o Task 5 ainda não existe, o conteúdo da aba fica vazio (nenhum bloco `tab === "tarefas"` ainda), o que é esperado neste passo.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/client-tabs.tsx src/app/admin/[id]/page.tsx
git commit -m "feat(tarefas): adiciona aba Tarefas ao ClientTabs"
```

---

### Task 5: Componente `TasksBoard` + wiring final em `admin/[id]/page.tsx`

**Files:**
- Create: `src/components/admin/tasks-board.tsx`
- Modify: `src/app/admin/[id]/page.tsx` (imports; carregamento de dados L101-106; `tabBadges` L213-247; novo bloco de render antes de L1141)

**Interfaces:**
- Consumes: `ProjectTask`, `TASK_STATUS_OPTIONS`, `TASK_STATUS_TONE`, `TASK_PRIORITY_OPTIONS`, `TEAM_MEMBERS` de `@/lib/project-tasks` (Task 1); `listProjectTasks` de `@/lib/project-tasks-server` (Task 3); `seedProjectTasksAction`, `addProjectTaskAction`, `removeProjectTaskAction`, `updateProjectTaskAction` de `@/app/admin/[id]/actions` (Task 3).
- Produces: `TasksBoard` (client component), consumido só por `admin/[id]/page.tsx`.

- [ ] **Step 1: Criar `src/components/admin/tasks-board.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  seedProjectTasksAction,
  addProjectTaskAction,
  removeProjectTaskAction,
  updateProjectTaskAction,
} from "@/app/admin/[id]/actions";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  TASK_STATUS_GROUP,
  TASK_PRIORITY_OPTIONS,
  TEAM_MEMBERS,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectType } from "@/lib/types";

/** Data (YYYY-MM-DD) já passou e a tarefa não está num status "fechado". */
function isOverdue(dataVencimento: string, status: TaskStatus): boolean {
  if (!dataVencimento) return false;
  if (TASK_STATUS_GROUP[status] === "fechado") return false;
  const hoje = new Date().toISOString().slice(0, 10);
  return dataVencimento < hoje;
}

function TaskRow({
  task,
  clientId,
  urlKey,
}: {
  task: ProjectTask;
  clientId: string;
  urlKey?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [prioridade, setPrioridade] = useState(task.prioridade ?? "");
  const [responsavel, setResponsavel] = useState(task.responsavel ?? "");
  const [dataInicial, setDataInicial] = useState(task.data_inicial ?? "");
  const [dataVencimento, setDataVencimento] = useState(
    task.data_vencimento ?? ""
  );
  const [pending, startTransition] = useTransition();

  function baseFd() {
    const fd = new FormData();
    fd.append("taskId", task.id);
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    return fd;
  }

  function saveField(field: string, value: string) {
    const fd = baseFd();
    fd.append(field, value);
    startTransition(async () => {
      await updateProjectTaskAction(fd);
      router.refresh();
    });
  }

  function remove() {
    const fd = baseFd();
    startTransition(async () => {
      await removeProjectTaskAction(fd);
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-fysi-line">
      <td className="px-3 py-2.5 text-sm text-fysi-deep">{task.titulo}</td>
      <td className="px-3 py-2.5">
        <select
          value={status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as TaskStatus;
            setStatus(next);
            saveField("status", next);
          }}
          className={`rounded-full border text-xs font-medium px-2.5 py-1 cursor-pointer focus:outline-none disabled:opacity-50 ${TASK_STATUS_TONE[status]}`}
        >
          {TASK_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <select
          value={prioridade}
          disabled={pending}
          onChange={(e) => {
            setPrioridade(e.target.value);
            saveField("prioridade", e.target.value);
          }}
          className="rounded-[8px] border border-fysi-line bg-white text-xs px-2 py-1"
        >
          {TASK_PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <select
          value={responsavel}
          disabled={pending}
          onChange={(e) => {
            setResponsavel(e.target.value);
            saveField("responsavel", e.target.value);
          }}
          className="rounded-[8px] border border-fysi-line bg-white text-xs px-2 py-1"
        >
          <option value="">Sem responsável</option>
          {TEAM_MEMBERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <input
          type="date"
          value={dataInicial}
          disabled={pending}
          onChange={(e) => setDataInicial(e.target.value)}
          onBlur={() => saveField("dataInicial", dataInicial)}
          className="rounded-[8px] border border-fysi-line bg-white text-xs px-2 py-1"
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="date"
          value={dataVencimento}
          disabled={pending}
          onChange={(e) => setDataVencimento(e.target.value)}
          onBlur={() => saveField("dataVencimento", dataVencimento)}
          className={`rounded-[8px] border bg-white text-xs px-2 py-1 ${
            isOverdue(dataVencimento, status)
              ? "border-red-300 text-red-700"
              : "border-fysi-line"
          }`}
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-xs text-red-700 underline underline-offset-2 disabled:opacity-50"
        >
          Remover
        </button>
      </td>
    </tr>
  );
}

export function TasksBoard({
  clientId,
  urlKey,
  projectType,
  tasks,
}: {
  clientId: string;
  urlKey?: string;
  projectType: ProjectType | null;
  tasks: ProjectTask[];
}) {
  const router = useRouter();
  const [novoTitulo, setNovoTitulo] = useState("");
  const [mostrarFechados, setMostrarFechados] = useState(false);
  const [pending, startTransition] = useTransition();

  function seed() {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await seedProjectTasksAction(fd);
      router.refresh();
    });
  }

  function add() {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("titulo", titulo);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await addProjectTaskAction(fd);
      setNovoTitulo("");
      router.refresh();
    });
  }

  const abertas = tasks.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo");
  const fechadas = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "fechado"
  );

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-medium text-fysi-deep">
            Tarefas do projeto
          </h3>
          {tasks.length > 0 ? (
            <p className="text-sm text-fysi-muted mt-1">
              {fechadas.length}/{tasks.length} fechadas
            </p>
          ) : null}
        </div>
        {tasks.length === 0 && projectType ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={seed}
            disabled={pending}
          >
            {pending ? "Gerando…" : "Gerar tarefas do template"}
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          {projectType
            ? 'Nenhuma tarefa ainda. Clique em "Gerar tarefas do template" pra criar o checklist padrão deste tipo de projeto.'
            : "Defina o tipo de projeto (na Visão geral) antes de gerar as tarefas."}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-left text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Prioridade</th>
                <th className="px-3 py-2 font-medium">Responsável</th>
                <th className="px-3 py-2 font-medium">Data inicial</th>
                <th className="px-3 py-2 font-medium">Data de vencimento</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {abertas.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  clientId={clientId}
                  urlKey={urlKey}
                />
              ))}
              {mostrarFechados
                ? fechadas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={clientId}
                      urlKey={urlKey}
                    />
                  ))
                : null}
            </tbody>
          </table>
          {fechadas.length > 0 ? (
            <button
              type="button"
              onClick={() => setMostrarFechados((v) => !v)}
              className="mt-3 text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              {mostrarFechados
                ? "Ocultar fechados"
                : `Mostrar ${fechadas.length} fechado${fechadas.length === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-fysi-line">
        <input
          type="text"
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="Nova tarefa…"
          className="flex-1 rounded-[8px] border border-fysi-line bg-white text-sm px-3 py-1.5"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={add}
          disabled={pending || !novoTitulo.trim()}
        >
          + Adicionar
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Carregar as tarefas em `admin/[id]/page.tsx`**

Mudar o `Promise.all` (linhas 101-106):

```ts
  const [{ data: client }, { data: responses }, { data: files }] =
    await Promise.all([
      service.from("clients").select("*").eq("id", id).maybeSingle(),
      service.from("briefing_responses").select("*").eq("client_id", id),
      service.from("briefing_files").select("*").eq("client_id", id),
    ]);
```

para:

```ts
  const [{ data: client }, { data: responses }, { data: files }, tasks] =
    await Promise.all([
      service.from("clients").select("*").eq("id", id).maybeSingle(),
      service.from("briefing_responses").select("*").eq("client_id", id),
      service.from("briefing_files").select("*").eq("client_id", id),
      listProjectTasks(id),
    ]);
```

No topo do arquivo, junto dos outros imports de componentes admin, adicionar:

```ts
import { TasksBoard } from "@/components/admin/tasks-board";
import { listProjectTasks } from "@/lib/project-tasks-server";
import { TASK_STATUS_GROUP } from "@/lib/project-tasks";
```

- [ ] **Step 3: Badge de progresso na aba (dentro de `tabBadges`, perto de `moodboard`)**

No objeto `tabBadges` (que termina com a entrada `moodboard: (() => {...})(),` por volta da linha 246), adicionar antes do fechamento `};`:

```ts
    tarefas: (() => {
      if (tasks.length === 0) return undefined;
      const fechadas = tasks.filter(
        (t) => TASK_STATUS_GROUP[t.status] === "fechado"
      ).length;
      return fechadas === tasks.length
        ? { tone: "mint" as const, label: "✓ completo" }
        : { tone: "yellow" as const, label: `${fechadas}/${tasks.length}` };
    })(),
```

- [ ] **Step 4: Renderizar a aba**

Logo depois do bloco que fecha a aba `briefing` (linha 1140, `        ) : null}`, antes de `          </div>` na linha 1141), adicionar:

```tsx
        {tab === "tarefas" ? (
          <TasksBoard
            clientId={client.id}
            urlKey={urlKey ?? undefined}
            projectType={(client.project_type as ProjectType | null) ?? null}
            tasks={tasks}
          />
        ) : null}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `ProjectType` não estiver importado em `page.tsx`, adicionar `import type { ProjectType } from "@/lib/types";` (o arquivo já importa esse tipo em outro ponto — conferir antes de duplicar o import).

- [ ] **Step 6: Verificar manualmente (fluxo completo)**

Pré-requisito: a migration do Task 2 precisa estar aplicada no banco (local ou remoto) antes deste passo.

Com `npm run dev` rodando:
1. Abrir um cliente com `project_type` já definido (ex: `landing-com-copy`) em `/admin/[id]?tab=tarefas&key=<senha>`.
2. Clicar "Gerar tarefas do template" — confirmar que aparecem exatamente 6 linhas, todas com status "A iniciar", na ordem: Copy LP, Informações Iniciais, Design, Ajustes, Implementação, DEP + Otimização.
3. Numa tarefa, colocar uma Data de vencimento no passado (ex: ontem) — confirmar que o campo de data fica com borda/texto vermelho (atrasada).
4. Mudar o status dessa mesma tarefa pra "Completo | Entregue" — confirmar que: (a) o campo de data para de ficar vermelho: a tarefa some da lista principal; (b) aparece um link "Mostrar 1 fechado" no rodapé da tabela; clicar nele reexibe a tarefa (com a data sem destaque vermelho); (c) o badge da aba na navegação lateral (`ClientTabs`) passa a mostrar `1/6`.
5. Atribuir um responsável e uma prioridade numa tarefa em aberto, recarregar a página (F5) e confirmar que os valores persistiram (não voltaram pro default).
6. Adicionar uma tarefa manual pelo campo "Nova tarefa…" — confirmar que aparece no fim da lista de tarefas abertas.
7. Remover essa tarefa manual — confirmar que ela some da lista.
8. Clicar "Gerar tarefas do template" de novo (com tarefas já existentes) — confirmar que **não duplica** as 6 tarefas originais (idempotência do `seedProjectTasksAction`).

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/tasks-board.tsx src/app/admin/[id]/page.tsx
git commit -m "feat(tarefas): TasksBoard na aba Tarefas da ficha do cliente"
```

---

## Self-Review Notes

- **Spec coverage:** núcleo da spec (§2 itens 1-3, sem autofill de EI/ClickUp) coberto por Tasks 1-5. Addendum §9 (templates confirmados + escopo) refletido em `DEFAULT_PROJECT_TASKS` (Task 1) e no header deste plano.
- **Placeholder scan:** nenhum "TBD"/"implementar depois" — todo código é completo e copiável.
- **Type consistency:** `TaskStatus` definido uma vez em `project-tasks.ts` (Task 1) e reusado em `actions.ts` (Task 3) e `tasks-board.tsx` (Task 5) via `import type`. `ProjectTask` idem. `TASK_STATUS_GROUP` definido no Task 1 e consumido idêntico nos três lugares onde importa (Task 3 pra `concluida_em`, Task 5 pra `isOverdue`/split abertas-fechadas, e o badge em `admin/[id]/page.tsx`). Nomes de action (`seedProjectTasksAction`, `addProjectTaskAction`, `removeProjectTaskAction`, `updateProjectTaskAction`) idênticos entre Task 3 (onde são definidas) e Task 5 (onde são importadas/chamadas). Migration (Task 2) e `TASK_STATUS_OPTIONS` (Task 1) têm os mesmos 13 valores de status, na mesma grafia (`kebab-case`) — se um dia adicionar um status novo, os dois lugares precisam mudar juntos (não há geração automática do CHECK a partir do TS).
