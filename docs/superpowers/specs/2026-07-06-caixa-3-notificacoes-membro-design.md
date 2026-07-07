# Caixa 3 — Central de notificações por membro (SPEC de design)

> Design doc. Não implementa código de produção. Aterrado no código atual do `briefing_app`.

## 1. Problema e estado atual

Hoje as notificações internas são **globais e não roteadas**. Todo aviso vai pra um único banner no topo de `/admin`, visto por qualquer admin logado. Não existe conceito de "de quem é essa tarefa".

Estado real do código:

- **Tabela** `public.admin_notifications` (`supabase/migrations/20260602000000_add_admin_notifications.sql`): colunas `id`, `client_id` (FK `clients`, `on delete cascade`), `kind` (check com 4 valores: `contrato.preenchido`, `briefing.concluido`, `pagamento.recebido`, `outro`), `title`, `message`, `created_at`, `read_at`. Índices `admin_notifications_unread_idx` (parcial `where read_at is null`) e `admin_notifications_client_idx`. **Não há coluna de destinatário/responsável.**
- **Criação** `createAdminNotification()` em `src/lib/notifications.ts:24` — recebe `{ clientId, kind, title, message }`, insere via service-role, best-effort (engole erro, só `console.warn`). Único produtor real hoje: `src/app/api/cliente/contrato/route.ts:180` (kind `contrato.preenchido`). Os kinds `briefing.concluido` e `pagamento.recebido` estão no enum mas **sem produtor** (grep confirma: só `contrato/route.ts` e `notifications.ts` chamam `createAdminNotification`).
- **Leitura/UI** `src/app/admin/page.tsx:84-90` busca as 5 mais recentes com `read_at is null` e passa pro `AdminNotificationsBanner` (`src/components/admin/admin-notifications-banner.tsx`). O banner é 100% global: mapeia `kind → KIND_META` (emoji/label/tom), sanitiza PII (`sanitizeForBanner`, `looksLikePII`, linhas 147-172) e linka pra `/admin/{client_id}`.
- **Dismiss** `dismissNotificationAction` (`src/app/admin/actions.ts:11`) e `dismissAllNotificationsAction` (`:32`) só setam `read_at = now()`. `read_at` é **um estado de leitura único e global** — quando um admin dispensa, some pra todos.
- **Identidade** `getAdminUser()` (`src/lib/admin.ts:13`) hoje **não distingue pessoas**: login por senha e por `?key=` retornam ambos `{ email: "admin@fysilab" }`. Só o caminho legado Supabase Auth + allowlist devolve o email real. **Não existe `member_id` na sessão.** Esse é o gap que a Caixa 0 resolve e do qual a Caixa 3 depende.

Consequência prática: "contrato novo pra fazer" não tem como chegar especificamente na pessoa responsável por contratos — todo mundo vê tudo, e a leitura de um "apaga" pro time inteiro.

## 2. Objetivo e escopo

**Objetivo:** dar destinatário às notificações. Cada evento é roteado pra um **membro responsável** (derivado do `kind` + config de roteamento), e cada membro vê/dispensa a própria fila sem afetar os outros. Um "ver tudo" continua existindo pra visão de dono.

### Entra (in scope)
- Coluna de destinatário (`assignee_member_id`) em `admin_notifications`.
- Roteamento `kind → membro responsável` no momento da criação (em `createAdminNotification`).
- Estado de leitura **por membro** (dismiss deixa de ser global).
- Banner/central filtrado pelo membro da sessão, com fallback "ver como" enquanto o login for compartilhado.
- Wiring dos produtores que já deveriam existir (`briefing.concluido`, `pagamento.recebido`) já com destinatário — de baixo custo, aproveita a migration.

### Fica de fora (YAGNI)
- **Notificação pra N destinatários simultâneos.** Assume-se **1 responsável por notificação** (ou `null` = todos). Isso mantém `read_at` como coluna simples e evita tabela de junção. Multi-destinatário fica pra depois, se surgir necessidade real.
- **Preferências por membro** (mutar kind, canais, digest por email/WhatsApp). Fora de escopo — a Caixa 3 roteia in-app; email/push continuam como estão (`teamEmail`).
- **Editor visual de regras de roteamento** sofisticado. Roteamento arranca de um mapa simples (ver §4); UI de config só se a decisão em aberto pedir.
- **Realtime/push** (Supabase Realtime, badge ao vivo). Mantém o modelo atual de reload/`revalidatePath`.
- **Histórico/inbox paginado com filtros ricos.** A central é a fila de não-lidas + um "marcar tudo".

## 3. Design proposto

### Arquitetura (mudança mínima sobre o que existe)

1. **Identidade da sessão (vem da Caixa 0).** `getAdminUser()` passa a resolver — ou a Caixa 0 expõe um helper irmão `getCurrentMember()` — um `member_id` a partir da sessão. Enquanto o login por senha for compartilhado, um seletor "atuando como {membro}" (persistido em cookie `fysi-member`) supre a identidade. A Caixa 3 **consome** esse `member_id`; não reinventa auth.

2. **Roteamento na escrita.** `createAdminNotification()` ganha um passo de resolução: dado o `kind` (e opcionalmente um `assigneeMemberId` explícito), consulta o mapa de roteamento e grava `assignee_member_id`. Se não resolver ninguém, grava `null` (= fila global/todos). Continua best-effort.

3. **Leitura por membro.** A query do banner passa a filtrar `assignee_member_id in (member_da_sessao, null)` e a considerar leitura por membro (ver §4 sobre `read_at` vs. tabela de reads). Dismiss marca lido **só pra aquele membro**.

4. **Componentes.**
   - `AdminNotificationsBanner` (existente) ganha, no `KIND_META`/linha do item, um selo discreto de responsável ("pra você" vs. "time"). Toda a sanitização de PII (linhas 147-172) permanece.
   - Nova página **Central** `/admin/notificacoes` (aba nova em `admin-tabs`, hoje: Clientes | Quadro | Cobranças | Relatórios | Contratos): lista a fila do membro (não-lidas + recentes lidas), com "marcar tudo como lido" (reaproveita `dismissAllNotificationsAction`, agora escopado ao membro).

### Fluxo de dados (criar → rotear → ver → dispensar)

```
Evento (contrato preenchido / briefing concluído / pagamento recebido)
  → createAdminNotification({ clientId, kind, title, message, assigneeMemberId? })
     → resolveAssignee(kind, assigneeMemberId?)  // mapa de roteamento (§4)
     → INSERT admin_notifications(..., assignee_member_id)
  → /admin (page.tsx) e /admin/notificacoes leem com filtro por member_id da sessão
  → AdminNotificationsBanner mostra "pra você" / "time"
  → dismiss → marca lido só pro membro (read por membro)
```

## 4. Mudanças de dados

### Nova tabela: `members` — **não** faz parte desta caixa
Pertence à Caixa 0. A Caixa 3 assume que existe `public.members(id uuid pk, nome text, ativo bool, ...)`. Todos os FKs abaixo apontam pra ela.

### `admin_notifications`: coluna de destinatário
```sql
alter table public.admin_notifications
  add column if not exists assignee_member_id uuid
    references public.members(id) on delete set null;

-- Fila por membro (não-lidas): cobre o filtro do banner/central.
create index if not exists admin_notifications_assignee_unread_idx
  on public.admin_notifications (assignee_member_id, created_at desc)
  where read_at is null;
```
`on delete set null`: se o membro sai, a notificação vira global em vez de sumir.

### Roteamento `kind → responsável` (escolher UMA das opções — ver §7)
**Opção A (simples, YAGNI-first):** coluna array em `members`, ownership por tipo.
```sql
-- Em members (Caixa 0) OU numa migration desta caixa se members não tiver:
alter table public.members
  add column if not exists handles_kinds text[] not null default '{}';
-- resolveAssignee(kind): primeiro member ativo com kind em handles_kinds; senão null.
```
**Opção B (config explícita):** tabela dedicada.
```sql
create table if not exists public.notification_routing (
  kind text primary key,
  assignee_member_id uuid references public.members(id) on delete set null
);
```
Recomendação do spec: **Opção B** — 1 linha por kind, trivial de editar via UI mínima, sem array-scan, e o fallback (`null`) é explícito.

### Estado de leitura por membro
Como o escopo fixa **1 destinatário por notificação**, `read_at` **continua servindo** — cada linha tem um único dono, então "lido" é por-linha = por-membro. Para notificações **globais** (`assignee_member_id is null`) que qualquer um pode dispensar, o dismiss global atual (marcar `read_at`) some pra todos — comportamento aceitável pra avisos de time. **Não é preciso** tabela de junção de reads enquanto multi-destinatário estiver fora de escopo. (Se a decisão em aberto virar multi-destinatário, aí sim entra `notification_reads(notification_id, member_id, read_at)` e o esforço sobe pra XL.)

## 5. Rotas / API e telas de UI

- **`src/lib/notifications.ts`** — `CreateInput` ganha `assigneeMemberId?: string`. Adiciona `resolveAssignee(service, kind, explicit?)` que lê o roteamento (§4). Mantém best-effort.
- **`src/lib/members.ts`** (Caixa 0) ou helper local — `getCurrentMemberId()` a partir da sessão/cookie. A Caixa 3 só o consome.
- **`src/app/admin/page.tsx`** — troca a query (linhas 84-90) por filtro `assignee_member_id.in.(member,null)`; passa `currentMemberId` pro banner pra rotular "pra você".
- **`src/app/admin/notificacoes/page.tsx`** (novo) — Central: fila do membro (não-lidas no topo, lidas recentes abaixo), botão "marcar tudo como lido" e "atuando como {membro}". `export const dynamic = "force-dynamic"`.
- **`src/components/admin/admin-tabs.tsx`** — nova aba "Notificações" (com contador de não-lidas do membro, opcional).
- **`src/components/admin/admin-notifications-banner.tsx`** — recebe `currentMemberId`; adiciona selo "pra você"/"time" por item. Sem mudar a sanitização de PII.
- **`src/app/admin/actions.ts`** — `dismissNotificationAction` e `dismissAllNotificationsAction` passam a escopar por membro (o "todas" só zera as do membro atual + as globais, não as de outros). Autorização continua via `getAdminUser`.
- **Produtores** — `src/app/api/cliente/contrato/route.ts:180` já pode passar `kind` e deixar o roteamento resolver o responsável de contratos. Wire novo de `briefing.concluido` (quando `briefing_submitted_at` é setado — ver `toggleBriefingConcluidoAction` em `src/app/admin/[id]/actions.ts:531` e o fluxo de submissão do cliente) e `pagamento.recebido` (em `setPaymentAction`, `src/app/admin/[id]/actions.ts:304`).

## 6. Dependências de outras caixas

- **Caixa 0 — Membros (bloqueante).** Fornece a tabela `members`, os FKs de destinatário/roteamento e — crucialmente — a **identidade da sessão → member_id**. Sem Caixa 0 não há "por membro": o banner não sabe filtrar e o roteamento não tem pra quem apontar. Toda a Caixa 3 assenta sobre isso.
- Sem dependência de outras caixas conhecidas. As integrações externas (ClickUp/Autentique/Resend/Drive/OpenAI) não são tocadas; email pro `teamEmail` segue como canal paralelo.

## 7. Riscos e decisões em aberto

- **Identidade sob login compartilhado (risco alto).** Hoje `getAdminUser` devolve `admin@fysilab` fixo. Sem a Caixa 0 dar member por sessão, o "por membro" degrada pra um seletor manual "atuando como". Decidir se a Caixa 0 traz Supabase Auth por membro ou se o MVP vive com o seletor.
- **Fonte do roteamento (Opção A vs. B).** Decisão de produto: array em `members` (dono implícito) vs. tabela `notification_routing` editável. Afeta a UI mínima de config.
- **Fallback quando não há responsável.** `null` = todos (recomendado) vs. cair pro dono da conta. Precisa de regra.
- **1 vs. N destinatários.** O spec fixa 1 pra manter `read_at` simples. Se o negócio exigir "vai pro contratos E pro financeiro", vira tabela de reads e sobe pra XL.
- **Retrocompat.** Notificações existentes ficam com `assignee_member_id = null` (global) — não quebram; aparecem pra todos até serem dispensadas. Aceitável.
- **Dismiss global.** Avisos globais dispensados por um somem pra todos — trade-off consciente do escopo YAGNI.

## 8. Ordem de implementação (incremental e testável)

1. **Migration da coluna** `assignee_member_id` + índice parcial (§4). Testável: insert com/sem assignee, `on delete set null` ao remover membro. *(não roda antes da Caixa 0 existir)*
2. **Roteamento** — criar `notification_routing` (Opção B) e `resolveAssignee()` em `notifications.ts`. Teste unitário: kind mapeado → member; kind sem regra → null.
3. **Escrita** — `createAdminNotification` grava `assignee_member_id`. Teste: contrato preenchido cai no responsável de contratos.
4. **Leitura filtrada** — ajustar query de `admin/page.tsx` + `getCurrentMemberId()` (ou seletor "atuar como"). Teste: membro A não vê fila de B; ambos veem globais.
5. **Dismiss por membro** — escopar as duas actions. Teste: A dispensar não afeta B.
6. **Central** `/admin/notificacoes` + aba em `admin-tabs` + selo "pra você"/"time" no banner. Teste de UI: fila correta por membro, "marcar tudo" só zera a do membro.
7. **Novos produtores** — wire `briefing.concluido` e `pagamento.recebido` já roteados. Teste: cada evento chega no membro certo.
8. **Retrocompat/migração de dados** — confirmar que linhas antigas (`assignee_member_id null`) aparecem como globais e são dispensáveis. Smoke test no `/admin`.
