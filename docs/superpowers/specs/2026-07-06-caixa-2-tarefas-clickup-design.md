# Caixa 2 — Projeto estilo ClickUp: tarefas, template de fases e Estrutura Inicial auto-consolidada

> Design doc. Não implementa código de produção. Aterrado no código atual do `briefing_app` (Next.js 16 App Router, React 19, Supabase, Tailwind 4).

## 1. Problema e estado atual

Hoje o app já tem **três camadas parciais** que cobrem pedaços do que a Caixa 2 pede, mas nenhuma resolve "gestão de tarefas por fase com responsável":

**a) Timeline por tipo de projeto (cliente-facing, não é tarefa).**
`src/lib/project-types.ts` → `buildTimeline(projectType, currentStageIndex)` monta uma lista hardcoded de `EtapaProjeto` por tipo (`landing-com-copy`, `landing-sem-copy`, `site-completo`, `seo`, `outro`). Cada etapa tem `titulo`, `prazo`, `atividades[]` e um `status` derivado do `currentStageIndex`. Isso é o que o **cliente** vê no painel — texto descritivo, não checklist acionável. As fases da Caixa 2 ("Informações Iniciais, Design, Ajustes, Implementação, DEP+Otimização") são **internas de produção** e não coincidem exatamente com essas etapas.

**b) Pipeline como ponteiro único.**
`src/app/admin/[id]/page.tsx` (linhas 529-616, seção "Pipeline do projeto") renderiza as etapas do `buildTimeline` como botões e chama `setStageAction` pra mover `clients.current_stage_index` (migration `20260502000000_add_current_stage_index.sql`). É **um inteiro só** — não há granularidade de tarefa, nem responsável, nem sub-itens marcáveis. `src/lib/workflow-lanes.ts` (`laneForClient`, linhas 91-104) lê esse mesmo índice via `buildTimeline` pra decidir a lane do Kanban do Quadro (`src/app/admin/quadro/page.tsx`). Ou seja: `current_stage_index` já é peça central e cliente-facing — não dá pra quebrar sem cuidado.

**c) ClickUp é um dump one-way de UMA task.**
`src/lib/clickup.ts` → `createClickUpBriefingTask` faz `POST /list/{CLICKUP_LIST_ID}/task` com o briefing inteiro em `markdown_description`, tags `["briefing", projectType]`, e guarda `clients.clickup_task_id`. Config é mínima: `env.clickupToken` + `env.clickupListId` (`src/lib/env.ts:60-61`) — token de API + uma lista, sem OAuth, sem webhook de volta, sem subtasks, sem assignees. `sendToClickupAction` (`actions.ts:62`) dispara isso uma vez. É export, não gestão.

**d) Estrutura Inicial (EI) já existe — mas 100% manual.**
`src/lib/ei-template.ts` (`EIData`, `renderEIMarkdown`) + `src/components/admin/ei-editor.tsx` (aba "briefing") + coluna `clients.ei_data jsonb` (migration `20260601000000_add_ei_data.sql`). O EI tem os campos exatos que a Caixa 2 quer consolidar: `briefingLink`, `driveLink`, `logo`, `imagens`, `fonteLetra`, `cores`, `paginasReferencia`, `copyExterno`, `secoes[]`, `rodape`. **Problema:** o time digita tudo à mão. Os dados já existem no sistema (`clients.*`, `briefing_responses`, `briefing_files`, `clients.fysi_drive_link` / `cliente_drive_link`) — mas não fluem sozinhos pro EI. O ask "consolida automaticamente TODOS os dados coletados" é justamente esse gap de autofill.

**Padrão de dados dominante do repo:** features novas viram `jsonb` numa coluna de `clients` + função `render*Markdown` + componente editor + server action (ver `entrega.ts`/`entrega-editor`, `moodboard.ts`/`moodboard-editor`, `ei-template.ts`/`ei-editor`). As tabelas relacionais são poucas: `clients`, `briefing_responses`, `briefing_files` (`20260430000000_initial_schema.sql`).

## 2. Objetivo e escopo

### Entra (v1)
1. **Camada de tarefas internas por fase**, com template por tipo de projeto, **responsável por tarefa** e status (`todo`/`doing`/`done`). Fonte de verdade = o app.
2. **Template de fases** definido em código (não em DB), instanciado como tarefas quando o `project_type` é definido/confirmado.
3. **Aba "Tarefas"** no `ClientTabs` do admin, com board por fase, marcar/desmarcar, atribuir responsável, adicionar/remover tarefa ad-hoc.
4. **Autofill da Estrutura Inicial**: função pura que pré-preenche `EIData` a partir de `clients` + `briefing_responses` + `briefing_files` + links de Drive, exposta como botão "Preencher do briefing" no `EIEditor` (merge não-destrutivo — nunca sobrescreve campo já editado à mão).
5. **Decisão arquitetural app-vs-ClickUp resolvida** (§3.1): app como fonte de verdade, ClickUp permanece como dump do briefing; espelho de tarefas no ClickUp fica como gancho opcional atrás de flag, não no caminho crítico.

### Fica de fora (YAGNI)
- **Sync bidirecional com ClickUp** (webhooks inbound, OAuth, mapeamento de custom fields, reconciliação de status). Grande superfície, ganho marginal pra time pequeno — ver §7.
- **Tarefas visíveis pro cliente no painel.** As fases internas são internas; o cliente continua vendo `buildTimeline`. Não mexer no painel do cliente.
- **View cross-client "minhas tarefas"** como tela dedicada no v1. A tabela relacional (§4) já habilita isso depois com um `select ... where responsavel = ?`, mas a tela não entra agora.
- **Datas/prazos, dependências entre tarefas, time-tracking, comentários por tarefa.** ClickUp faz isso; não reimplementar.
- **Reescrever `buildTimeline` ou `current_stage_index`.** Continuam sendo a camada cliente-facing. Tarefas são uma camada mais fina por baixo.
- **IA pra gerar copy das seções do EI.** O autofill é determinístico (mapeamento de campos), não geração via OpenAI.

## 3. Design proposto

### 3.1 App vs ClickUp — recomendação

**Construir no app, com ClickUp como espelho opcional.** Razões:

- A estrutura de tarefas precisa **alimentar o que o app já tem**: `current_stage_index` (timeline do cliente em `buildTimeline`) e as lanes do Quadro (`laneForClient`). Se o ClickUp fosse a fonte de verdade, o app precisaria fazer polling/webhook pra saber o estado — coupling caro.
- A integração ClickUp atual é um **token + 1 lista** (`env.ts:60-61`), sem OAuth nem webhook. Two-way sync exigiria reescrever a integração inteira (auth, mapeamento de listas/pastas por cliente, custom fields, idempotência). É uma caixa própria, não parte desta.
- Equipe pequena e conjunto de responsáveis pequeno → o valor "gestão de tarefas madura do ClickUp" (mobile, notificações) não compensa a duplicação e o risco de dessincronização.
- O app já é onde o time abre cada cliente (`/admin/[id]`), vê briefing, contrato, financeiro, entrega. Tarefas na mesma tela reduz troca de contexto.

Mantém-se `createClickUpBriefingTask` como está (dump do briefing). Deixa-se um gancho opcional `createClickUpPhaseTasks(clientId)` atrás de flag pra quem quiser espelhar as tarefas como subtasks no ClickUp — fora do caminho crítico do v1.

### 3.2 Template de fases (código, não DB)

Novo arquivo `src/lib/project-phases.ts`, no mesmo espírito de `PROJECT_TYPE_OPTIONS` em `project-types.ts`:

```ts
export type PhaseKey =
  | "info-inicial" | "design" | "ajustes" | "implementacao" | "dep-otimizacao";

export interface PhaseTemplate {
  key: PhaseKey;
  titulo: string;                 // "Informações Iniciais"
  tarefas: string[];              // títulos default das tarefas da fase
}

// Template por tipo de projeto. Default reaproveitado por landing/site;
// SEO e "outro" podem divergir (ver openQuestions).
export const PHASE_TEMPLATES: Record<ProjectType, PhaseTemplate[]> = { ... };
```

As fases são **estáveis e versionadas em código** (como `GENERAL_LANES` e `buildTimeline` já são). Não viram linhas de DB — só as tarefas instanciadas viram (§4). `template_version` é gravado por tarefa pra permitir migração futura de template sem quebrar projetos antigos.

### 3.3 Tarefas — tabela relacional

Escolha **relacional (não jsonb)** para tarefas, divergindo do padrão jsonb do repo, porque:
- "Responsável por tarefa" implica querer "tarefas do fulano" atravessando clientes — trivial com `where responsavel = ?`, doloroso com jsonb.
- Cada tarefa mapeia 1-1 a um `clickup_task_id` opcional (espelho) — coluna natural numa linha.
- É a peça mais provável de crescer (a Sara adiciona tarefas ad-hoc por projeto).

Fase **não** vira tabela separada — é uma coluna `phase_key` na tarefa, com a ordem/título das fases vindo do template em código. Evita over-normalização (mesma filosofia de derivar lanes de código em `workflow-lanes.ts` em vez de tabela de lanes).

### 3.4 Fluxo de dados

```
project_type definido  ──►  botão "Gerar tarefas do template"
                            └─► seedTasksFromTemplate(clientId, project_type)
                                └─► insert project_tasks (uma linha por tarefa do template)

Aba Tarefas (admin/[id]?tab=tarefas)
  ├─ TasksBoard lê project_tasks do cliente, agrupa por phase_key (ordem do template)
  ├─ toggleTaskAction / setAssigneeAction / addTaskAction / removeTaskAction
  └─ progresso por fase (done/total) e badge no ClientTabs

Estrutura Inicial (aba briefing → EIEditor)
  └─ botão "Preencher do briefing"
     └─ autofillEIAction
        └─ buildEIFromSources(client, briefing_responses, briefing_files, driveLinks)
           └─ merge não-destrutivo em EIData → salva ei_data (fluxo setEIAction existente)
```

### 3.5 Autofill da Estrutura Inicial

Nova função pura em `src/lib/ei-autofill.ts`:

```ts
export function buildEIFromSources(input: {
  client: ClientRow;                       // fysi_drive_link, cliente_drive_link, magic_slug...
  responses: BriefingResponse[];           // briefing_responses
  files: BriefingFile[];                   // briefing_files (logo, imagens)
  painelAdminUrl: string;
}): Partial<EIData>
```

Mapeamento determinístico (best-effort, campos sem match ficam vazios pro time preencher):
- `briefingLink` ← URL do painel admin do cliente (já construída em `admin/[id]/page.tsx` via `painelLink`).
- `driveLink` ← `client.fysi_drive_link ?? client.cliente_drive_link`.
- `logo` / `imagens` ← agrupar `briefing_files` pelos `field_id` de logo/imagens (usando `isFileField`/labels de `briefing-labels`).
- `cores` / `fonteLetra` / `copyExterno` ← respostas dos `field_id` correspondentes do briefing (bloco de identidade visual / copy). Onde não houver campo exato → deixa vazio.

`autofillEIAction` faz **merge não-destrutivo**: só preenche chaves de `EIData` que estão vazias/`""`; nunca apaga edição manual. UI: botão no header do `EIEditor` ("Preencher do briefing") + toast do que foi preenchido. Isso entrega o "consolida automaticamente" sem risco de estragar trabalho já feito.

## 4. Mudanças de dados

### Nova tabela `project_tasks`

Esboço de migration (`supabase/migrations/2026XXXXXXXXXX_add_project_tasks.sql`), seguindo o estilo idempotente do repo:

```sql
-- ============================================================
-- project_tasks — tarefas internas de produção por fase.
-- Fonte de verdade das fases/tarefas do projeto (estilo ClickUp),
-- instanciadas de PHASE_TEMPLATES quando o project_type é definido.
-- ============================================================
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,

  phase_key text not null,          -- 'info-inicial' | 'design' | 'ajustes'
                                    -- | 'implementacao' | 'dep-otimizacao'
  titulo text not null,
  ordem int not null default 0,     -- ordem dentro da fase

  responsavel text,                 -- membro da equipe (texto/chave; time pequeno)
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done')),
  done_at timestamptz,

  origem text not null default 'template'
    check (origem in ('template', 'manual')),
  template_version int not null default 1,
  clickup_task_id text,             -- espelho opcional (v1: sempre null)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_client_idx
  on public.project_tasks(client_id);
create index if not exists project_tasks_responsavel_idx
  on public.project_tasks(responsavel);
create index if not exists project_tasks_status_idx
  on public.project_tasks(status);

-- trigger de updated_at reaproveita public.touch_updated_at()
create trigger project_tasks_touch
  before update on public.project_tasks
  for each row execute function public.touch_updated_at();
```

RLS: o admin acessa via `createSupabaseServiceRoleClient()` (service role, ignora RLS — mesmo padrão de `admin/[id]/page.tsx:94`). Habilitar RLS na tabela e **não** criar policy pública (nega tudo por default; só service role lê/escreve). Cliente nunca vê tarefas.

### Sem novas colunas em `clients` para tarefas
`current_stage_index`, `ei_data`, `ei_atualizado_at` continuam como estão. O autofill do EI **não** precisa de migration — usa `ei_data` existente.

## 5. Rotas / API e telas de UI

### Server Actions (em `src/app/admin/[id]/actions.ts`)
- `seedTasksFromTemplateAction(clientId)` — instancia `project_tasks` do `PHASE_TEMPLATES[project_type]` se ainda não houver tarefas (idempotente; não duplica).
- `toggleTaskAction(taskId, status)` — muda status; grava `done_at` quando vira `done`.
- `setTaskAssigneeAction(taskId, responsavel)`.
- `addTaskAction(clientId, phaseKey, titulo)` — `origem='manual'`, `ordem` = max+1 da fase.
- `removeTaskAction(taskId)`.
- `autofillEIAction(clientId)` — carrega client+responses+files, chama `buildEIFromSources`, faz merge com `ei_data` atual, salva (reusa lógica de `setEIAction`).

Todas server actions (mesmo padrão dos forms de `admin/[id]/page.tsx`), preservando `key` na URL, `revalidatePath` da página do cliente.

### Telas
- **Nova aba "Tarefas"** em `src/components/admin/client-tabs.tsx` (`ClientTab` passa a incluir `"tarefas"`; `validTabs` em `admin/[id]/page.tsx:77` idem). Badge: `done/total` no estilo `ClientTabBadges` (ex.: tone `yellow` `"3/12"`, tone `mint` `"✓ completo"`).
- **Componente `src/components/admin/tasks-board.tsx`** (client component, estilo de `moodboard-editor`/`ei-editor`):
  - Fases como blocos empilhados (accordion ou cards), na ordem do template.
  - Cada tarefa = checkbox (toggle `todo`↔`done`), título, select de `responsavel`, ação remover. Botão "+ tarefa" por fase.
  - Cabeçalho da fase: progresso `n/total` + barrinha (reusar padrão de barra de progresso de `page.tsx:805-810`).
  - Estado vazio: botão **"Gerar tarefas do template"** (chama `seedTasksFromTemplateAction`) quando não há tarefas e `project_type` está definido; aviso "defina o tipo de projeto" quando não está.
- **`EIEditor`** ganha botão "Preencher do briefing" no header (ao lado de "Copiar MD"/"Salvar EI", `ei-editor.tsx:157-185`), chamando `autofillEIAction`.
- **Quadro (`/admin/quadro`)**: sem mudança obrigatória no v1. Opcional (fast-follow): usar % de tarefas concluídas pra enriquecer o card, mas `laneForClient` continua baseado em `current_stage_index`.

## 6. Dependências de outras caixas

- **Caixa 1 — Cadastro e briefing** (`caixa-1-cadastro-e-briefing`): é a fonte dos dados que o autofill do EI consolida (`clients.*`, `briefing_responses`, `briefing_files`). Sem briefing preenchido, o autofill preenche pouco.
- **Caixa Drive / Google Drive** (`caixa-drive-google`): fornece `fysi_drive_link` / `cliente_drive_link` (migrations `20260525120000_add_drive_links.sql`, `20260530000000_add_google_drive_folders.sql`) que o EI consome como `driveLink`.
- **Caixa ClickUp** (`caixa-clickup-integracao`): dona da integração ClickUp (`src/lib/clickup.ts`, `env.ts`). O gancho opcional de espelho (`createClickUpPhaseTasks`) pertence a ela; esta caixa só o consome se ligado.

Não há dependência bloqueante — o autofill degrada graciosamente (campos sem fonte ficam vazios) e as tarefas funcionam mesmo sem Drive/ClickUp.

## 7. Riscos e decisões em aberto

- **Conteúdo dos templates de fase é decisão operacional do time.** As fases-exemplo do enunciado são um chute razoável; a lista real de tarefas por fase e por tipo de projeto precisa ser confirmada pela Sara/Karine (openQuestion #1). Risco: entregar template errado e virar ruído. Mitigação: template é constante em código, fácil de ajustar; `origem='manual'` permite adaptar por projeto.
- **Relação entre `current_stage_index` e as tarefas.** Hoje o índice move a timeline do cliente e as lanes do Quadro. Se as tarefas virarem a nova granularidade, há risco de duas fontes de verdade divergirem. Decisão v1: **manter `current_stage_index` como camada cliente-facing e o admin continua avançando manual**; auto-avançar ao completar uma fase fica como openQuestion (#3) / fast-follow.
- **Divergência do padrão jsonb do repo.** Tarefas relacionais é intencional (§3.3), mas é a primeira tabela nova desde o schema inicial — vale um comentário no migration explicando o porquê (queryability por responsável + mapeamento 1-1 ClickUp).
- **Espelho ClickUp pode enganar.** Se ligado, subtasks no ClickUp não voltam pro app (sem webhook). Por isso fica atrás de flag e off por default — evita a expectativa falsa de sync.
- **Mapeamento briefing→EI depende dos `field_id` reais.** Precisa cruzar com `briefing-schema`/`briefing-labels` na implementação. Não é bloqueante (best-effort, resto manual), mas define quão "automático" fica de fato.

## 8. Ordem de implementação (incremental, testável)

1. **Template em código** — `src/lib/project-phases.ts` com `PhaseKey`, `PhaseTemplate`, `PHASE_TEMPLATES` (default landing/site + placeholders SEO/outro). Testável em isolamento (unit: shape do template por tipo). Sem UI ainda.
2. **Migration `project_tasks`** — criar tabela + índices + trigger + RLS. Testável: rodar migration, inserir/consultar via SQL.
3. **Server actions de tarefas** — `seedTasksFromTemplateAction` (idempotência!), `toggle`, `setAssignee`, `add`, `remove`. Testável via chamada direta + verificação no DB.
4. **Aba + `TasksBoard`** — adicionar `"tarefas"` a `ClientTabs`/`validTabs`, renderizar board, fiar as actions, badge `done/total`. Testável na tela `/admin/[id]?tab=tarefas` com um cliente real.
5. **Autofill do EI** — `src/lib/ei-autofill.ts` (`buildEIFromSources`, pura, com testes de mapeamento) → `autofillEIAction` (merge não-destrutivo) → botão no `EIEditor`. Testável: cliente com briefing preenchido gera EI populado sem apagar edições manuais.
6. **(Opcional / fast-follow)** — `createClickUpPhaseTasks` atrás de flag; auto-avanço de `current_stage_index` ao completar fase; enriquecer card do Quadro com % de tarefas.

Cada passo é mergeável sozinho: 1-2 não têm efeito visível; 3-4 entregam gestão de tarefas; 5 entrega a consolidação automática do EI; 6 é gordura opcional.