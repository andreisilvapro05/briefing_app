# Caixa 1 — Painel Fysi por áreas

Spec de design (design doc). **Não** implementa código de produção — descreve a reorganização do admin do `briefing_app` em áreas claras, a separação de clientes ativos/inativos e a quebra do arquivo gigante em componentes focados.

Stack de referência: Next.js 16 (App Router, `force-dynamic`, server actions), React 19, Supabase (service-role client server-side), Tailwind 4. Integrações que já tocam esses dados: ClickUp (`sendToClickupAction`), Autentique (`ContractCard`), Resend (`resendClientLinkAction`), Google Drive (`createClientFolders`), webhook do dashboard financeiro (`sendDashboardWebhook`).

---

## 1. Problema e estado atual

### 1.1 O arquivo gigante
`src/app/admin/[id]/page.tsx` tem **1220 linhas** e é um único server component que mistura fetch de dados, backfill de slug, derivação de badges e ~8 seções de UII inline. Mapa concreto do que vive lá hoje:

- **L96–101**: `Promise.all` carregando `clients`, `briefing_responses`, `briefing_files`.
- **L136–156**: lazy backfill do `magic_slug` (efeito colateral de escrita dentro do render da página).
- **L158–235**: derivação de `etapas` (via `buildTimeline`), contagem de campos por bloco, e o objeto `tabBadges` (lógica de badge por aba, ~30 linhas de ternários aninhados).
- **L250–368**: `<header>` com o `aside` de controle (forms de `setProjectTypeAction` e `setClientStatusAction`, bloco ClickUp, botões Reenviar link / Enviar ao ClickUp, `ClientPreviewButton`, `DeleteClientButton`).
- **L370–375**: `<ClientTabs>` (5 abas: `geral`, `briefing`, `moodboard`, `financeiro`, `entrega`).
- **L377–698** (`tab === "geral"`): 4 seções inline — Acesso do cliente (link mágico + código + mensagem WhatsApp), Fases do projeto (marcar chamada/briefing feitos + link de revisão de copy), Pipeline do projeto (grid de etapas + prev/next), Dados do cliente (form de contrato).
- **L701–732**: monta `EIEditor`, `MoodboardEditor`, `EntregaEditor` por aba.
- **L734–749**: `ContractCard` (visível em `geral` **e** `financeiro`).
- **L751–880** (`tab === "financeiro"`): seção Pagamento inteira, com IIFE inline calculando total/pago/pendente/pct.
- **L882–971** (`tab === "entrega"`): seção Drive (dois forms `setDriveLinksAction`).
- **L973–1098** (`tab === "briefing"`): resumo de preenchimento + respostas bloco a bloco + `MateriaisPainel`.
- **L1104–1214**: helpers locais — `FieldInput`, `groupByBloco`, `renderFieldValue`, `renderValue`, `formatMoney`, `formatDate`.

Problemas diretos disso:
- **Não dá pra reusar** `renderFieldValue`, `formatMoney`, `formatDate` em nenhum outro lugar (estão presos no arquivo). `formatDate`/`relativeTime` já estão **duplicados** em `src/app/admin/page.tsx` (L344–372).
- Marcador de fase, pipeline e chamada estão **espalhados** — "chamada" aparece como um toggle solto em Fases (L473–483), sem relação visual com um conceito de "chamada agendada".
- A aba `geral` acumula 4 responsabilidades não relacionadas (acesso, fases, pipeline, dados de contrato).
- Toda mudança em qualquer área exige abrir e rolar 1220 linhas.

### 1.2 Etapas mal organizadas + bug latente
O pipeline (L529–616) desenha as etapas a partir de `buildTimeline(client.project_type)` (`src/lib/project-types.ts`). Mas `setStageAction` (`src/app/admin/[id]/actions.ts` L137–142) **recalcula o índice máximo com números mágicos** (`landing-sem-copy` → 4, `outro` → 3, resto → 5) em vez de derivar de `buildTimeline`. Se as timelines mudarem em `project-types.ts`, o `maxIndex` do action fica dessincronizado silenciosamente. É dívida a corrigir junto da reorganização das etapas.

### 1.3 Listagem sem ativo/inativo
`src/app/admin/page.tsx` mostra **uma tabela única** ordenada por `created_at desc` (L63–68), com filtros por `q`/`status`/`tipo` (L70–77) e um selo "Parado" derivado de `last_client_activity_at` (L104–113). Não há separação visual entre clientes **ativos** (em andamento) e **inativos** (concluídos/abandonados) — um cliente entregue há meses aparece no mesmo bloco de quem está em produção. Curiosamente, a página de Cobranças (`src/app/admin/cobrancas/page.tsx` L50–61) **já tem** o padrão `ativas`/`inativas` via filtro — é a referência de UX a seguir.

### 1.4 Dados de chamada existem mas não aparecem
A migration `supabase/migrations/20260502120000_add_contract_and_meeting_fields.sql` já criou `chamada_agendada_at`, **`chamada_data` (timestamptz)** e **`chamada_observacoes` (text)**. O cliente preenche `chamada_data`/`chamada_observacoes` via `src/app/api/cliente/chamada/route.ts` (L51–56), e `src/app/api/me/stage/route.ts` (L59) lê `chamada_data`. **Mas o admin não exibe nem edita nada disso** — só tem o toggle booleano de `chamada_agendada_at` (page L473–483 / `toggleChamadaFeitaAction`). A área "Chamadas agendadas" pedida é, na prática, **expor dado que já existe** no banco.

---

## 2. Objetivo e escopo

### 2.1 Objetivo
Reorganizar `/admin/[id]` em **áreas nomeadas e coesas** e **quebrar o arquivo de 1220 linhas** em componentes focados, sem mudar o comportamento das server actions existentes. Separar **ativos vs inativos** na listagem `/admin`. Reorganizar as **etapas** num componente próprio e corrigir o `maxIndex` dessincronizado.

### 2.2 Entra no escopo
1. **Quebra do `page.tsx`** em: um orquestrador fino + um módulo de data-loading + ~10 componentes de apresentação em `src/components/admin/client/`.
2. **Reagrupamento das abas** do `/admin/[id]` nas áreas: **Visão geral**, **Dados do cliente**, **Dados do briefing**, **Chamadas agendadas**, **Contrato & pagamento** (mantém Moodboard e Entrega como abas existentes).
3. **Área Chamadas agendadas**: exibe `chamada_data` + `chamada_observacoes` (já no banco) e adiciona um form pro admin definir/editar data e observações — além do toggle `chamada_agendada_at` que já existe.
4. **Etapas reorganizadas**: extrair `StagePipeline` como componente, derivar `maxIndex` de `buildTimeline` (elimina os números mágicos do action).
5. **Ativos vs inativos** em `/admin`: dividir a tabela em dois grupos derivados de `status` (ativo = `nao-iniciado` | `em-andamento`; inativo = `concluido` | `abandonado`), com o inativo colapsável.
6. **Extração de utilitários compartilhados** (`formatDate`, `formatMoney`, `relativeTime`, `renderFieldValue`) pra um lugar reutilizável, removendo a duplicação existente.

### 2.3 Fica de fora (YAGNI)
- **Nenhuma tabela ou coluna nova** (a área Chamadas usa colunas existentes; ativo/inativo deriva de `status`).
- **Sem integração Calendly automática** pra popular `chamada_data` — só edição manual no admin (webhook fica pra outra caixa).
- **Sem coluna `arquivado_at`** de arquivamento manual — inativo é 100% derivado de `status` por ora (ver questão aberta).
- **Sem mexer na lógica interna** de `ContractCard`, `EIEditor`, `MoodboardEditor`, `EntregaEditor`, `MateriaisPainel` — são reaproveitados como estão.
- **Sem drag-and-drop** de etapas nem edição de nomes de etapa (as timelines seguem vindo de `project-types.ts`).
- **Sem tocar nas 15 server actions** além de (a) corrigir `maxIndex` em `setStageAction` e (b) adicionar `setChamadaAgendamentoAction`.
- **Sem view admin-wide "todas as chamadas da semana"** — a área Chamadas é por cliente (uma agenda global seria outra caixa).

---

## 3. Design proposto

### 3.1 Princípio
`page.tsx` vira **orquestrador fino**: resolve auth, carrega dados (delegado a um módulo `_data.ts`), escolhe a aba e monta os componentes de área. Toda UI de seção vira componente burro (server component sempre que não precisar de estado; client component só onde já era, ex. botões com `useState`). As server actions **não mudam de assinatura** — os componentes só passam a receber props e renderizam os mesmos `<form action={...}>`.

### 3.2 Árvore de arquivos alvo

```
src/app/admin/[id]/
  page.tsx                    # orquestrador (~140 linhas): auth, tab routing, layout
  actions.ts                  # +setChamadaAgendamentoAction; fix maxIndex em setStageAction
  _data.ts                    # loadClientDetail(id): Promise.all + slug backfill + derivados
  _badges.ts                  # computeTabBadges(client, derived): a lógica de L202–235

src/components/admin/client/
  client-header.tsx           # aside: forms tipo/status, ClickUp, ações (L250–368)
  access-panel.tsx            # Acesso do cliente (L380–464)
  stage-pipeline.tsx          # Etapas reorganizadas (L529–616)
  client-data-form.tsx        # Dados do cliente p/ contrato (L618–697) — área "Dados do cliente"
  drive-links-panel.tsx       # Drive (L882–971) — movido p/ "Dados do cliente"
  chamadas-panel.tsx          # NOVO — área "Chamadas agendadas"
  payment-panel.tsx           # Pagamento (L751–880)
  briefing-summary.tsx        # Preenchimento do briefing (L976–1028)
  briefing-responses.tsx      # Respostas bloco a bloco (L1030–1096)
  field-input.tsx             # FieldInput reusável (L1104–1136)

src/lib/
  format.ts                   # formatMoney, formatDate, relativeTime (des-duplicar)
  briefing-view.tsx           # renderFieldValue, renderValue, groupByBloco (JSX helpers)
  admin-client-status.ts      # isAtivo(status), particionaClientes() p/ /admin
```

> Nota Next 16: componentes com `<form action={serverAction}>` podem ser server components — não precisam de `"use client"`. `briefing-view.tsx` exporta JSX helpers (retornam `ReactNode`), então é `.tsx` mas sem `"use client"`.

### 3.3 Reagrupamento das abas → áreas
`ClientTab` em `src/components/admin/client-tabs.tsx` passa de 5 pra ~7 valores, mapeando 1:1 as áreas pedidas:

| Aba (id) | Área | Componentes montados |
|---|---|---|
| `geral` | Visão geral | `AccessPanel`, `StagePipeline`, marcadores de fase |
| `cliente` | **Dados do cliente** | `ClientDataForm`, `DriveLinksPanel` |
| `briefing` | **Dados do briefing** | `EIEditor`, `BriefingSummary`, `BriefingResponses`, `MateriaisPainel` |
| `chamadas` | **Chamadas agendadas** | `ChamadasPanel` |
| `financeiro` | **Contratos** & pagamento | `ContractCard`, `PaymentPanel` |
| `moodboard` | Moodboard | `MoodboardEditor` (inalterado) |
| `entrega` | Entrega (DEP) | `EntregaEditor` (inalterado) |

O `ClientHeader` (aside com tipo/status/ações) fica **fora das abas**, sempre visível (como hoje). `ContractCard` deixa de aparecer duplicado em `geral`+`financeiro` (page L736) e passa a viver só na aba `financeiro` — o comentário atual diz que é "peça crítica", então o header ganha um **atalho/deep-link** "Ver contrato →" apontando pra `?tab=financeiro` (mantém a proeminência sem duplicar markup).

### 3.4 Fluxo de dados
1. `page.tsx` chama `getAdminUser({ urlKey })` (inalterado) e `loadClientDetail(id)` de `_data.ts`.
2. `loadClientDetail` faz o `Promise.all` das 3 queries, roda o backfill de `magic_slug`, e retorna um objeto `ClientDetail` **já com os derivados** (etapas via `buildTimeline`, `byBloco`, `camposPorBloco`, `camposPreenchidos`, `filesList`, `painelLink`). Tudo que hoje está espalhado entre L96–199.
3. `computeTabBadges(detail)` (de `_badges.ts`) devolve o `ClientTabBadges` — tira as ~30 linhas de ternário do render.
4. `page.tsx` passa fatias tipadas do `detail` pra cada componente de área. Nenhum componente refaz query — recebe props.

Isso mantém tudo **server-side** e `force-dynamic` como já é; nenhuma mudança de RLS (segue usando `createSupabaseServiceRoleClient`).

### 3.5 Área "Chamadas agendadas" (nova UI, dados existentes)
`ChamadasPanel` recebe `chamada_agendada_at`, `chamada_data`, `chamada_observacoes` e renderiza:
- **Estado**: se `chamada_data` setada → mostra data/hora formatada (`formatDate` + hora) + observações; se `chamada_observacoes === "[PULOU]"` (sentinela já usada em `api/cliente/chamada` L56) → badge "Cliente pulou agendamento".
- **Form** (`setChamadaAgendamentoAction`, nova): `<input type="datetime-local" name="chamadaData">` + `<textarea name="chamadaObservacoes">` + salvar. Ao salvar com data preenchida, seta também `chamada_agendada_at` (mantém coerência com o toggle e com o dashboard do cliente que lê `chamadaAgendada`).
- **Toggle** existente (`toggleChamadaFeitaAction`) migra pra cá — some da aba "geral".

### 3.6 Etapas reorganizadas (`StagePipeline`)
- Recebe `etapas` (já resolvidas por `buildTimeline`) + `currentStage`. Mesma UI de grid, mas com o rótulo de estado explícito (Concluída / Atual / Pendente) e prazo da etapa (`etapa.prazo`, já disponível em `EtapaProjeto`).
- **Correção**: `setStageAction` passa a derivar `maxIndex = buildTimeline(project_type).length - 1` em vez dos números mágicos (actions.ts L137–142). Fonte única de verdade = `project-types.ts`.

### 3.7 Listagem ativo/inativo (`/admin`)
- `src/lib/admin-client-status.ts`: `isAtivo(status) = status === "nao-iniciado" || status === "em-andamento"`; `particionaClientes(rows)` → `{ ativos, inativos }`.
- `/admin/page.tsx` renderiza **dois blocos**: "Clientes ativos" (aberto) e "Clientes inativos (concluídos / abandonados)" em `<details>` colapsado, reaproveitando a mesma `<table>`/`StatusPill` (extrair `ClientsTable` como componente pra não duplicar markup).
- Filtro explícito de `status` (query param) continua funcionando e, quando aplicado, sobrepõe a partição (mostra só o grupo relevante). O selo "Parado" (`isStuck`) fica só no grupo de ativos.

---

## 4. Mudanças de dados

**Nenhuma migration nova é necessária** — é o ponto forte deste design. Justificativa por área:

| Área | Colunas usadas | Já existem? |
|---|---|---|
| Contratos | `contrato_status`, `contrato_signed_url`, `contrato_dados`, `autentique_document_id`, `pagamento_*` | Sim (`20260525000000`, `20260527000000`) |
| Dados do cliente | `nome,email,empresa,endereco,cep,cpf,rg,cnpj,razao_social`, `fysi_drive_link`, `cliente_drive_link` | Sim (`20260502120000`, `20260525120000`) |
| Dados do briefing | `briefing_responses`, `briefing_files`, `ei_data` | Sim (initial + `20260601000000`) |
| Chamadas agendadas | `chamada_agendada_at`, **`chamada_data`**, **`chamada_observacoes`** | **Sim** (`20260502120000`) |
| Ativo/inativo | `status` | Sim (initial schema) |

Esboço de migration **só se** a questão aberta de arquivamento manual for aprovada (fora do escopo default):

```sql
-- OPCIONAL — só se optar por arquivamento manual independente de status
alter table public.clients
  add column if not exists arquivado_at timestamptz;
create index if not exists clients_arquivado_idx on public.clients(arquivado_at);
comment on column public.clients.arquivado_at is
  'Arquivamento manual pelo admin. Null = ativo na listagem.';
```

Recomendação: **não** rodar isso agora (YAGNI) — derivar inativo de `status`.

---

## 5. Rotas / API e telas de UI

### 5.1 Rotas (todas já existem — sem novas rotas)
- `/admin` — lista, agora particionada em ativos/inativos.
- `/admin/[id]` e `/admin/[id]?tab=...` — mesmo route, `tab` ganha os valores `cliente` e `chamadas` além dos atuais (`geral`, `briefing`, `moodboard`, `financeiro`, `entrega`). Validar em `validTabs` (page L77–86).

### 5.2 Server actions
- **Inalteradas** (reaproveitadas pelos novos componentes): `setProjectTypeAction`, `setClientStatusAction`, `resendClientLinkAction`, `sendToClickupAction`, `setClientContractDataAction`, `setDriveLinksAction`, `setPaymentAction`, `setCopyReviewLinkAction`, `toggleChamadaFeitaAction`, `toggleBriefingConcluidoAction`, `setStageAction` (com fix de `maxIndex`).
- **Nova**: `setChamadaAgendamentoAction(formData)` — valida `clientId`, parseia `chamadaData` (datetime-local → ISO), grava `chamada_data` + `chamada_observacoes`, seta `chamada_agendada_at = now()` se veio data, `revalidatePath('/admin/${clientId}')`. Mesmo padrão de auth (`getAdminUser({ urlKey })`) das demais.

### 5.3 Telas
- **`/admin` (lista)**: header + `AdminTabs` (inalterado) + banner de notificações (inalterado) + filtros (inalterado) + **bloco "Ativos"** (tabela) + **bloco "Inativos"** (`<details>`).
- **`/admin/[id]`**: `ClientHeader` (topo, sempre visível, com atalho "Ver contrato →") + `ClientTabs` (7 abas) + área ativa. Sticky tabs e `overflow-x-auto` já existem em `client-tabs.tsx` (L93) — comportam 7 abas.

---

## 6. Dependências de outras caixas

- **Nenhuma dependência bloqueante.** Esta caixa é auto-contida: reorganização + exposição de dados existentes.
- **Acoplamentos a respeitar (não quebrar)**:
  - `src/lib/workflow-lanes.ts` (`laneForClient`) consome `status`, `chamada_agendada_at`, `contrato_status`, `current_stage_index` — a partição ativo/inativo **deve usar o mesmo `status`** pra não divergir do Quadro (`/admin/quadro`) e Relatórios (`/admin/relatorios`), que já leem esses campos.
  - `sendDashboardWebhook` em `setPaymentAction` continua disparando — a extração do `PaymentPanel` não pode remover esse efeito.
  - Se existir uma futura "caixa de agenda/Calendly" que popule `chamada_data` via webhook, ela **reusa** o `ChamadasPanel` desta caixa (ponto de extensão, não dependência).

---

## 7. Riscos e decisões em aberto

**Riscos**
- **Regressão no reagrupamento de abas**: mover seções entre abas muda deep-links que a equipe possa ter salvo (ex. `?tab=financeiro`). Mitigar mantendo os ids atuais (`geral`, `briefing`, `financeiro`, `moodboard`, `entrega`) e só **adicionando** `cliente` e `chamadas`.
- **`ContractCard` deixar de aparecer em `geral`**: hoje é intencional (comentário L734). Mitigar com o atalho "Ver contrato →" no header e badge de status já visível na aba.
- **Backfill de `magic_slug` no data-loader**: mover a escrita (page L136–156) pra `_data.ts` mantém o efeito colateral no caminho de leitura — aceitável (é como está), mas documentar que `loadClientDetail` **pode escrever**.
- **Churn grande de um arquivo crítico** sem testes automatizados no repo — mitigar fazendo a extração incremental (seção 8) e validando visualmente cada aba.

**Decisões em aberto** (ver `openQuestions`)
1. Ativo/inativo derivado de `status` vs coluna `arquivado_at`.
2. Chamadas manual vs integração Calendly.
3. Aceitar 7 abas vs agrupar Moodboard/Entrega.

---

## 8. Ordem de implementação (incremental e testável)

Cada passo é isolado e verificável abrindo o admin — sem big-bang.

1. **Utilitários compartilhados**: criar `src/lib/format.ts` (`formatMoney`, `formatDate`, `relativeTime`) e `src/lib/briefing-view.tsx` (`renderFieldValue`, `renderValue`, `groupByBloco`). Trocar os usos em `page.tsx` **e** `admin/page.tsx` (des-duplicar). Verificar: lista e detalhe renderam datas/valores igual a antes.
2. **Data-loader**: extrair `_data.ts` (`loadClientDetail`) e `_badges.ts` (`computeTabBadges`). `page.tsx` passa a consumir. Verificar: badges das abas idênticos.
3. **Fix `setStageAction`**: derivar `maxIndex` de `buildTimeline`. Verificar: avançar/voltar stage nos 5 tipos de projeto respeita o comprimento real da timeline.
4. **Extrair componentes sem mudar abas**: `ClientHeader`, `AccessPanel`, `StagePipeline`, `ClientDataForm`, `DriveLinksPanel`, `PaymentPanel`, `BriefingSummary`, `BriefingResponses`, `FieldInput`. `page.tsx` só monta. Verificar aba por aba: cada form ainda salva.
5. **Reagrupar abas**: adicionar `cliente` e `chamadas` ao `ClientTab`/`TABS`, mover `ClientDataForm`+`DriveLinksPanel` pra `cliente`, mover marcadores/pipeline conforme seção 3.3, adicionar atalho "Ver contrato →" no header. Verificar navegação e `validTabs`.
6. **Área Chamadas**: criar `setChamadaAgendamentoAction` + `ChamadasPanel`; migrar o toggle pra lá. Verificar: definir data/obs persiste em `chamada_data`/`chamada_observacoes` e reflete no dashboard do cliente (`api/me/stage`).
7. **Ativo/inativo na lista**: `admin-client-status.ts` + extrair `ClientsTable` + renderizar dois blocos em `/admin`. Verificar: concluídos/abandonados caem no `<details>`, filtro de status ainda funciona, selo "Parado" só nos ativos.
8. **Limpeza**: confirmar `page.tsx` ~140 linhas, sem helpers órfãos; rodar `next build`/typecheck; revisar visualmente as 7 abas + a lista.
