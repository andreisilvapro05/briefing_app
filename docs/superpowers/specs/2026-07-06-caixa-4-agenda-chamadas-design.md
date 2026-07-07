# Caixa 4 — Agenda / chamadas integradas

> Spec de design (design doc). Não implementa código de produção. Serve pra alinhar arquitetura, dados e ordem de execução antes de escrever a feature.

## 1. Problema e estado atual

Hoje o agendamento da chamada de alinhamento é um widget do Calendly embutido e um marcador booleano no banco. Não há integração real de agenda nem aviso ao time.

Fluxo atual, arquivo por arquivo:

- **`src/app/agendar/page.tsx`** — página cliente. Renderiza o widget inline do Calendly (`CALENDLY_URL = "https://calendly.com/karinesackt/briefing"`, linha 11) via `<Script src="assets.calendly.com/.../widget.js">`. Um `useEffect` (linhas 52-67) escuta `window` por `postMessage` e, quando recebe `data.event === "calendly.event_scheduled"`, chama `markAsScheduled()`, que faz `POST /api/cliente/chamada` com `{ clientId, action: "agendou" }` (linhas 33-48). Nota crítica: **só manda `action`** — o `payload.event.uri` que o Calendly entrega no `postMessage` (tipado em `CalendlyEventDetail`, linhas 13-16) é ignorado, e a **data/hora real da chamada nunca sai do widget**.
- **`src/app/api/cliente/chamada/route.ts`** — grava o marcador. O `Body` (zod, linhas 14-19) aceita `chamadaData?` e `observacoes?`, mas como o front nunca envia, na prática só roda o ramo `action === "agendou"` que faz `updates.chamada_agendada_at = now()` (linha 50). `chamada_data` e `chamada_observacoes` ficam nulos. `action === "pulou"` zera `chamada_agendada_at` e grava `"[PULOU]"` em `chamada_observacoes`. Usa `createSupabaseServiceRoleClient()`. **Não dispara nenhuma notificação nem e-mail pro time** — é a única "milestone" do cliente que não avisa ninguém (compare com a rota de contrato abaixo).
- **`supabase/migrations/20260502120000_add_contract_and_meeting_fields.sql`** — já criou as colunas `chamada_agendada_at timestamptz`, `chamada_data timestamptz`, `chamada_observacoes text` e o índice `clients_chamada_idx`. O comentário da coluna `chamada_data` diz "preenchida manualmente ou via webhook Calendly" — ou seja, o webhook foi previsto e nunca implementado.
- **`src/app/admin/[id]/page.tsx`** (linhas 473-483) — o admin tem um botão "Marcar chamada como feita" (`toggleChamadaFeitaAction`) que **reusa `chamada_agendada_at`** como flag de "chamada feita". Ou seja, hoje o mesmo campo significa duas coisas: "cliente marcou" (via `/agendar`) e "admin confirmou que aconteceu" (toggle no admin). Semanticamente sobrecarregado.

Infra que já existe e vamos reaproveitar:

- **`src/lib/google-drive.ts`** — padrão de integração Google via **service account**: lê `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON em base64) + `GOOGLE_DRIVE_PARENT_FOLDER_ID`, monta `new google.auth.GoogleAuth({ credentials, scopes })`, cacheia o client, e é **offline-safe** (se as envs faltam, `isConfigured()` retorna false e tudo vira no-op silencioso retornando `null`). `googleapis` já é dependência (`package.json`: `"googleapis": "^173.0.0"`). Esse é o molde exato do `google-calendar.ts` novo.
- **`src/lib/notifications.ts`** — `createAdminNotification({ clientId, kind, title, message })` insere em `admin_notifications`. Best-effort (nunca propaga erro). `NotificationKind` = `"contrato.preenchido" | "briefing.concluido" | "pagamento.recebido" | "outro"`. (Esta é a Caixa 3.)
- **`src/lib/email.ts`** — `sendEmail({ to, subject, html })` via Resend, demo-safe se `RESEND_API_KEY` ausente. Tem templates tipo `htmlContratoPreenchidoTime`. Falta um pra chamada.
- **`src/app/api/cliente/contrato/route.ts`** (linhas 175-208) — **o padrão a copiar**: ao salvar, dispara `void createAdminNotification({ kind: "contrato.preenchido", ... })` + `void sendEmail({ to: env.teamEmail, ... html: htmlContratoPreenchidoTime(...) })`. Best-effort, com cuidado de privacidade (banner só mostra primeiro nome/empresa). A rota de chamada deve espelhar isso.
- **`src/lib/env.ts`** — `getServerEnv()` centraliza envs. Já tem `teamEmail`, `googleServiceAccountKey`, `googleDriveParentFolderId`, `dashboardWebhookUrl`. É onde entram as novas envs de Calendar/Calendly.

## 2. Objetivo e escopo

**Objetivo:** quando o cliente agenda a chamada, (a) o time é avisado na hora e (b) o evento aparece numa agenda compartilhada da Fysi, sem depender de alguém abrir o Calendly.

### Entra (in scope)

1. **Aviso ao time na chamada agendada** — notificação admin (`admin_notifications`) + e-mail pro `teamEmail`, espelhando o padrão da rota de contrato. Independente e de baixo risco. **Esta parte é a que amarra com a Caixa 3.**
2. **Captura da data/hora real da chamada** — preencher `chamada_data` de fato (hoje sempre nulo), passando o `event.uri` do Calendly do `postMessage` até a rota e resolvendo o `start_time`/`end_time` pela API do Calendly no servidor.
3. **Sync pra Google Calendar compartilhado** — novo `src/lib/google-calendar.ts` (molde do `google-drive.ts`), cria um evento num calendário compartilhado da Fysi via service account. Guarda `chamada_gcal_event_id` e `chamada_gcal_link` no cliente. Offline-safe: sem `GOOGLE_CALENDAR_ID` → no-op.

### Fica de fora (YAGNI)

- **Não** convidamos o cliente como attendee no evento do Google Calendar. Service account não manda convite/e-mail de evento sem domain-wide delegation (Workspace) — e o cliente **já recebe** o convite do próprio Calendly. Criamos o evento só pra visibilidade do time. (Reduz drasticamente o setup.)
- **Não** substituímos o Calendly por um seletor de horário próprio. O widget continua sendo a fonte da marcação.
- **Não** implementamos reagendamento/cancelamento bidirecional (Calendly `invitee.canceled` → apagar evento). Fase futura; primeiro provar o caminho feliz.
- **Não** criamos calendário por-cliente nem lembretes/automação de follow-up.
- **Não** mexemos na semântica sobrecarregada do toggle "chamada feita" do admin nesta caixa (só registramos como risco). Se der, separamos `chamada_realizada_at` numa caixa futura.

## 3. Design proposto

Arquitetura em duas metades desacopláveis, ambas penduradas na rota existente `POST /api/cliente/chamada`.

```
/agendar (client)                    /api/cliente/chamada (server)
  Calendly widget                      ┌─────────────────────────────┐
  postMessage event_scheduled          │ 1. valida body (zod)        │
    → { action:"agendou",              │ 2. UPDATE chamada_agendada_at│
        calendlyEventUri }  ──POST──▶  │ 3. resolve datetime (Calendly│
                                       │    API via event.uri) →      │
                                       │    chamada_data              │
                                       │ 4. google-calendar.ts        │
                                       │    createChamadaEvent()  ────┼──▶ Google Calendar
                                       │    → gcal_event_id/link      │     (calendário Fysi
                                       │ 5. Caixa 3: notif + e-mail   │      compartilhado)
                                       └──────────────┬───────────────┘
                                                      ▼
                                          admin_notifications  +  Resend (teamEmail)
```

Todos os passos 3-5 são **best-effort com `void`/try-catch** — nenhum bloqueia a resposta 200 ao cliente, igual ao padrão da rota de contrato. Se Calendly API/Calendar/Resend estiverem off, o cliente ainda vê "Chamada agendada com sucesso" e `chamada_agendada_at` fica gravado.

### Componentes

- **`src/lib/google-calendar.ts` (novo)** — cópia estrutural do `google-drive.ts`:
  - `isConfigured()` → checa `googleServiceAccountKey && googleCalendarId`.
  - `getCalendarClient()` → `new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/calendar.events"] })`, `google.calendar({ version: "v3", auth })`, cacheado. Reusa a mesma `GOOGLE_SERVICE_ACCOUNT_KEY` base64 do Drive.
  - `createChamadaEvent({ clientName, empresa, startIso, endIso, description }): Promise<{ id, htmlLink } | null>` → `calendar.events.insert({ calendarId: env.googleCalendarId, requestBody: { summary: 'Chamada · ' + (empresa||clientName), description, start: { dateTime: startIso, timeZone: "America/Sao_Paulo" }, end: {...} } })`. Retorna `null` se não configurado ou em erro (log + no-op), nunca lança.
  - `calendarStatus()` → `{ configured, reason? }` pra futura UI de status (espelha `driveStatus()`).
- **`src/lib/calendly.ts` (novo, opcional conforme decisão do datetime)** — `fetchScheduledEvent(eventUri): Promise<{ startIso, endIso } | null>` usando `fetch` com `Authorization: Bearer ${CALENDLY_API_TOKEN}`. Offline-safe: sem token → `null`. Só isto precisa de token novo; se o time preferir webhook, ver §7.
- **`src/lib/email.ts`** — adicionar `htmlChamadaAgendadaTime({ cliente, quando, adminLink })` no mesmo estilo visual dos outros templates (header escuro, pill, CTA "Abrir painel do cliente →").
- **`src/lib/notifications.ts`** — adicionar `"chamada.agendada"` ao union `NotificationKind`.
- **`src/app/api/cliente/chamada/route.ts`** — orquestra 2→5.
- **`src/app/agendar/page.tsx`** — passar `calendlyEventUri: data.payload?.event?.uri` no corpo do POST (o valor já chega no `postMessage`, só não é encaminhado).

### Fluxo de dados

1. Cliente confirma no widget → `postMessage` com `event.uri`.
2. Front POSTa `{ clientId, action:"agendou", calendlyEventUri }`.
3. Rota grava `chamada_agendada_at = now()` (comportamento atual, imutável).
4. Se veio `calendlyEventUri` e há `CALENDLY_API_TOKEN`: busca `start_time`/`end_time`, grava em `chamada_data` (+ `chamada_observacoes` com o horário legível).
5. Se há datetime e Calendar configurado: cria evento, grava `chamada_gcal_event_id`/`chamada_gcal_link`.
6. Sempre (com `teamEmail`): `createAdminNotification({ kind:"chamada.agendada" })` + `sendEmail`.

## 4. Mudanças de dados

Colunas `chamada_agendada_at`, `chamada_data`, `chamada_observacoes` **já existem** (migration `20260502120000`). Precisamos apenas de: guardar as refs do evento GCal, e liberar o novo `kind` na constraint de `admin_notifications`.

Nova migration `supabase/migrations/20260708000000_add_chamada_gcal.sql` (esboço):

```sql
-- Refs do evento criado no Google Calendar compartilhado da Fysi.
alter table public.clients
  add column if not exists chamada_gcal_event_id text,
  add column if not exists chamada_gcal_link     text;

comment on column public.clients.chamada_gcal_event_id is
  'ID do evento no Google Calendar da Fysi (null = sync desligado ou falhou).';

-- Libera o kind 'chamada.agendada' nas notificações do admin (Caixa 3).
-- A CHECK atual (migration 20260602000000) não inclui esse valor.
alter table public.admin_notifications
  drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications
  add constraint admin_notifications_kind_check check (kind in (
    'contrato.preenchido',
    'briefing.concluido',
    'pagamento.recebido',
    'chamada.agendada',
    'outro'
  ));
```

Sem mudança de RLS (rota usa service role). Sem backfill.

## 5. Rotas/API e telas de UI

### API

- **`POST /api/cliente/chamada`** (existente, estendida) — `Body` ganha `calendlyEventUri: z.string().url().optional()`. Fluxo passa a: update marcador → (best-effort) resolver datetime → criar evento GCal → notificar time. Mantém o contrato de resposta `{ ok: true }` e o fallback `{ mode: "demo" }`.
- Nenhuma rota nova obrigatória. (Se no futuro trocar postMessage por webhook do Calendly, aí sim entra `POST /api/webhooks/calendly` com verificação de assinatura — fora do escopo agora, ver §7.)

### UI

- **`/agendar`** — sem mudança visual. Único ajuste: encaminhar `event.uri` no POST. A tela de sucesso (linhas 99-121) continua igual.
- **`/admin/[id]` (aba "Visão geral")** — pequeno acréscimo na seção "Fases do projeto" (perto do toggle de chamada, ~linha 467): quando `client.chamada_data` existir, mostrar a data/hora formatada (`Intl` pt-BR, já há `formatDate` no arquivo) e, se `client.chamada_gcal_link`, um link "Abrir no Google Agenda →". Read-only; reaproveita o padrão dos links do Drive. Sem novo componente.
- **Caixa 3 / banner do `/admin`** — a nova notificação `chamada.agendada` aparece automaticamente onde as outras já aparecem; nada específico aqui além do `kind` novo.

### Envs novas (em `getServerEnv()`)

- `GOOGLE_CALENDAR_ID` — ID do calendário Fysi compartilhado. Sem ela → sync no-op.
- `CALENDLY_API_TOKEN` — só se formos pela via "API do Calendly" pra resolver o horário. Sem ela → `chamada_data` fica nulo (degrada pro comportamento de hoje), mas notificação ainda dispara.
- Reaproveita `GOOGLE_SERVICE_ACCOUNT_KEY` (já existe) e `TEAM_EMAIL`/`RESEND_API_KEY` (já existem).

Setup manual (uma vez), análogo ao do Drive: criar/escolher um calendário "Fysi · Chamadas", compartilhar com o e-mail `xxx@yyy.iam.gserviceaccount.com` do service account com permissão **"Fazer alterações nos eventos"**, e copiar o Calendar ID (Configurações do calendário → "ID do calendário").

## 6. Dependências de outras caixas

- **Caixa 3 — Notificações / avisos ao time** (dependência direta e explícita): reusamos `createAdminNotification` (`src/lib/notifications.ts`) + `sendEmail` (`src/lib/email.ts`). Esta caixa **adiciona** o `kind` `"chamada.agendada"` ao contrato da Caixa 3 (union de tipos + CHECK do banco + template de e-mail). Se a Caixa 3 for reestruturada, os pontos de acoplamento são: o enum `NotificationKind` e a constraint `admin_notifications_kind_check`.
- Independência do Drive: compartilha só o `google-drive.ts` como **referência de padrão** (não como código), e a env `GOOGLE_SERVICE_ACCOUNT_KEY`. Nenhuma outra caixa bloqueia.

## 7. Riscos e decisões em aberto

- **De onde vem a data/hora real?** É o maior nó. O `postMessage` do Calendly entrega `event.uri`, não o `start_time`. Três caminhos:
  - **(A) API do Calendly** — passar o `event.uri` e chamar `GET {uri}` com `CALENDLY_API_TOKEN`. Menor mudança no fluxo (mantém postMessage), mas adiciona dependência de token e 1 request extra no caminho. **Recomendado pro MVP.**
  - **(B) Webhook `invitee.created`** — server-to-server, payload traz `scheduled_event.start_time` completo e é mais confiável (não depende do browser do cliente). Mais robusto, porém exige plano Calendly com webhooks, endpoint novo com verificação de assinatura, e mapear invitee→clientId. Melhor a médio prazo.
  - **(C) Manual** — admin digita a data no `/admin`. Zero automação; só faz sentido como fallback.
- **Service account não convida attendees** sem domain-wide delegation. Mitigado por escopo: criamos evento **sem** convidar o cliente (ele já tem o do Calendly). Se um dia quisermos que o convite saia da agenda da Fysi, aí precisa DWD (Workspace) — decisão adiada.
- **Duplicidade de agenda:** se a Karine já conecta Calendly → Google Calendar pessoal, nosso evento num calendário *compartilhado* é complementar (visibilidade do time), não substituto. Confirmar que não vira ruído na agenda pessoal dela.
- **Semântica sobrecarregada de `chamada_agendada_at`:** hoje serve tanto pra "cliente marcou" quanto pro toggle admin "chamada feita" (`toggleChamadaFeitaAction`). Ao começar a popular `chamada_data`, fica claro que faltam estados distintos (agendada vs realizada). Não resolvemos aqui, mas o design não piora isso — só registra a dívida.
- **Fuso:** fixar `America/Sao_Paulo` no evento; o `start_time` do Calendly vem em UTC (ISO-8601), então passamos o ISO cru com `timeZone` explícito e deixamos o Google resolver.
- **Reagendou/cancelou:** fora do escopo. Se o cliente remarca no Calendly, o evento antigo no nosso calendário fica órfão até implementarmos o webhook `invitee.canceled`. Aceitável no MVP (baixo volume, admin vê no painel).

## 8. Ordem de implementação (passos incrementais, testáveis)

Cada passo é entregável e testável isolado. Passos 1-2 já dão valor (Caixa 3) e podem ir sozinhos; 3-5 são o sync de agenda.

1. **Notificação ao time (independente, pronto).** Migration: adicionar `"chamada.agendada"` à CHECK de `admin_notifications`. Adicionar o kind ao union em `notifications.ts`. Criar `htmlChamadaAgendadaTime` em `email.ts`. Na rota `/api/cliente/chamada`, no ramo `action === "agendou"`, disparar `void createAdminNotification(...)` + `void sendEmail({ to: env.teamEmail, ... })`, espelhando `contrato/route.ts:180-208`. **Teste:** agendar no `/agendar` → ver banner no `/admin` + e-mail no `teamEmail` (ou log `[email demo skipped]` sem chave). Não depende de Google/Calendly.
2. **Encaminhar o `event.uri`.** Em `agendar/page.tsx`, incluir `calendlyEventUri: data.payload?.event?.uri` no corpo do POST. Estender o `Body` zod da rota com o campo opcional. **Teste:** log no servidor confirma que o URI chega (ainda sem uso).
3. **Resolver datetime (Calendly).** Criar `src/lib/calendly.ts` com `fetchScheduledEvent(uri)`; na rota, se veio URI + token, gravar `chamada_data` (+ horário legível em `chamada_observacoes`). Offline-safe. **Teste:** com `CALENDLY_API_TOKEN` setado, `chamada_data` populado; sem token, degrada pro comportamento atual (nulo, sem erro).
4. **Lib do Calendar.** Criar `src/lib/google-calendar.ts` (molde do `google-drive.ts`) + colunas `chamada_gcal_event_id`/`chamada_gcal_link` (mesma migration do passo 1 ou nova). Na rota, se há `chamada_data` + Calendar configurado, `createChamadaEvent(...)` e gravar as refs. **Teste:** com `GOOGLE_CALENDAR_ID` + calendário compartilhado, evento aparece no Google Agenda; sem env, no-op silencioso.
5. **UI read-only no admin.** Em `admin/[id]/page.tsx`, mostrar data/hora da chamada e link "Abrir no Google Agenda" quando existirem. **Teste:** visual no painel do cliente que agendou.

Fase futura (não neste ciclo): webhook `invitee.created`/`canceled` do Calendly (troca o passo 2-3 por server-to-server e habilita cancelamento/reagendamento), e separar `chamada_realizada_at` do `chamada_agendada_at`.