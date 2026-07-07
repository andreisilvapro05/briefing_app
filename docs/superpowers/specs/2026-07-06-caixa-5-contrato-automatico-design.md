# Caixa 5 — Contrato assina sozinho (Autentique automático)

> Design doc. NÃO implementa código de produção. Objetivo: quando o cliente assina no Autentique, o `contrato_status` vira `assinado` sozinho (hoje é manual), disparando notificação e o evento outbound — sem ninguém clicar em "Atualizar status".

## 1. Problema e estado atual

Hoje a detecção de assinatura é **100% manual**. O admin precisa abrir `/admin/[id]` e clicar num botão.

**O que já existe (grounded):**

- **`src/lib/autentique.ts`** — cliente GraphQL. Duas funções:
  - `createDocument()` (linhas 57–138): cria o doc e dispara o e-mail de assinatura.
  - `getDocument(documentId)` (linhas 143–212): consulta o estado atual. Já devolve `fullySigned` (linha 201–202: `signers.length > 0 && signers.every(signedAt)`), `signedUrl`, `originalUrl` e `signers[]` com `signedAt`/`rejectedAt`. **Não há** nenhum helper de webhook nem de registro de webhook.
- **`src/app/api/admin/contracts/send/[id]/route.ts`** — gera o `.docx`, envia ao Autentique e persiste `autentique_document_id`, `contrato_status='pendente'`, `contrato_dados` (linhas 159–174). Fysi assina primeiro (`sortable: true`, linha 143–150).
- **`src/app/api/admin/contracts/refresh/[id]/route.ts`** — **este é o coração do fluxo manual**. Admin-only. Faz `getDocument`, calcula `newStatus` (`rejeitado`/`assinado`/`pendente`, linhas 55–60), atualiza `contrato_status` + `contrato_signed_url` (linhas 62–68) e **só dispara o outbound `contrato.assinado` quando o status TRANSICIONA pra assinado** (`newStatus === "assinado" && previousStatus !== "assinado"`, linha 76). Toda a lógica que precisamos automatizar já vive aqui — só falta um gatilho que não seja um clique.
- **`src/app/api/admin/contracts/mark-signed/[id]/route.ts`** — override manual (cliente assinou fora do fluxo / webhook falhou). Marca `assinado` e dispara o outbound sempre (não checa transição, pois é ação deliberada do admin).
- **`src/app/api/fysi/webhook/route.ts`** — ATENÇÃO: apesar do nome, **não é** o receiver do Autentique. É o receiver do *próprio* barramento de eventos do briefing_app: valida HMAC via `X-Fysi-Signature` com `DASHBOARD_WEBHOOK_SECRET` (linha 74) e reencaminha pro `app-financeiro` (linha 28–34). Serve de referência de padrão HMAC, mas o webhook do Autentique é uma rota nova e separada.
- **`src/components/admin/contract-card.tsx`** — a UI. `refresh()` (linhas 238–258) chama a rota de refresh; botão "Atualizar status" (linha 429–437). `markSigned()` (linhas 208–236) chama mark-signed. Status vem via props (`contratoStatus`) renderizado como `Pill` (linhas 274–278).

**Contexto de dados/estágio (grounded):**

- Colunas de contrato em `clients` (migration `20260525000000_add_contract_columns.sql`): `autentique_document_id text`, `contrato_status text CHECK in ('pendente','assinado','rejeitado','cancelado')`, `contrato_signed_url text`, `contrato_dados jsonb`. Há índice em `contrato_status`, mas **não há índice em `autentique_document_id`** — e o webhook precisa buscar o cliente por esse id.
- Estágio do projeto: `current_stage_index` (0-based) em `clients` (migration `20260502000000`). Avança **manualmente** via `setStageAction` em `src/app/admin/[id]/actions.ts` (linhas 114–166). **Insight importante:** em `src/lib/project-types.ts` (`buildTimeline`, linhas 51+), "Assinatura de contrato" é uma *atividade* dentro do stage 0 ("Onboarding"), junto com briefing e chamada — **não é um stage próprio**. Logo, incrementar `current_stage_index` na assinatura pularia briefing/chamada. Ver §7.
- Notificações admin: tabela `admin_notifications` (migration `20260602000000`) + `createAdminNotification()` em `src/lib/notifications.ts`. O CHECK de `kind` hoje só aceita `'contrato.preenchido' | 'briefing.concluido' | 'pagamento.recebido' | 'outro'` — **não existe `contrato.assinado`**.
- Outbound: `sendDashboardWebhook` (`src/lib/dashboard-webhook.ts`) já tem o evento `contrato.assinado` tipado e é offline-safe (nunca propaga erro). O `contrato.assinado` já flui pro app-financeiro via `/api/fysi/webhook`.
- E-mail: `src/lib/email.ts` (`sendEmail` + templates `html*`). Já existe `htmlContratoPreenchidoTime` (notifica o time quando o cliente *preenche* o contrato) — bom molde pra um "contrato assinado".

## 2. Objetivo e escopo

**Objetivo:** ao cliente assinar no Autentique, o sistema detecta sozinho e roda o mesmo pipeline do refresh manual: atualiza `contrato_status='assinado'` + `contrato_signed_url`, dispara o outbound `contrato.assinado` (transição-only) e notifica o admin.

**Entra:**
1. **Webhook receiver do Autentique** (preferido): rota pública nova, protegida por token, que reage a eventos de assinatura.
2. **Reconciliação compartilhada**: extrair a lógica hoje dentro de `refresh/[id]/route.ts` pra um helper (`src/lib/contracts.ts`) reusado por refresh (manual), webhook e polling. Fonte da verdade = `getDocument()`, nunca os campos crus do payload.
3. **Polling agendado como rede de segurança** (Vercel Cron): varre clientes `pendente` com `autentique_document_id` e reconcilia. Cobre webhook perdido/fora do ar.
4. **Notificação admin** na assinatura (`admin_notifications`) + manter/expor `contrato_signed_at`.
5. **Idempotência**: assinar N vezes ou webhook+polling coincidirem → status muda uma vez, outbound dispara uma vez.

**Fica de fora (YAGNI):**
- Auto-avançar `current_stage_index` (assinatura é sub-item do Onboarding — ver §7). A timeline do cliente já reflete `contrato_status` via `/api/me/stage`.
- E-mail de confirmação pro cliente (deixar como toggle/opcional — §7).
- Tratar `rejeitado`/`cancelado` como fluxo rico (webhook já vai atualizar o status via reconcile; sem UI extra dedicada agora).
- Retry queue / dead-letter durável. O polling **é** o retry. Sem tabela de eventos.
- Remover os botões manuais. Ficam como fallback (o mark-signed é explicitamente o plano B).

## 3. Design proposto

### Arquitetura (dois gatilhos, um pipeline)

```
Autentique (cliente assina)
      │  POST assinado
      ▼
/api/webhooks/autentique?token=SECRET   ◄── gatilho 1 (preferido, ~instantâneo)
      │
      │  extrai documentId do payload
      ▼
reconcileContractByDocumentId(documentId)  ── src/lib/contracts.ts (NOVO helper)
      ▲          │
      │          ├─ getDocument() ....... fonte da verdade (reusa autentique.ts)
gatilho 2        ├─ update clients (status + signed_url + contrato_signed_at)
Vercel Cron      ├─ SE transição→assinado: createAdminNotification + sendDashboardWebhook
/api/cron/       └─ retorna {changed, newStatus}
 contracts-poll
(rede de segurança, a cada 15 min)

gatilho 3 (manual, já existe): botão refresh / mark-signed → mesmo helper
```

**Princípio central:** o payload do Autentique **só serve pra descobrir QUAL documento mudou**. Nunca confiamos nos campos de status do payload (formato instável entre versões / eventos parciais). Sempre re-consultamos `getDocument()`. Isso torna o webhook robusto e o mesmo helper serve os três gatilhos.

### Componentes

- **`src/lib/contracts.ts` (NOVO)** — `reconcileContractByDocumentId(documentId)` e `reconcileContractByClientId(clientId)`. Contém a lógica hoje em `refresh/[id]/route.ts` (linhas 40–105): busca cliente, `getDocument`, calcula `newStatus`, faz o update, e no gate de transição dispara outbound + notificação. Retorna `{ clientId, previousStatus, newStatus, changed, signedUrl }`. Idempotente por natureza (o gate `previousStatus !== 'assinado'`).
- **`/api/webhooks/autentique/route.ts` (NOVO)** — público, `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Valida token (§5), extrai `documentId`, chama `reconcileContractByDocumentId`, responde 200 rápido. Sempre 200 pra eventos válidos porém irrelevantes (ex.: doc desconhecido) pra o Autentique não ficar re-tentando.
- **`/api/cron/contracts-poll/route.ts` (NOVO)** — guardado por `CRON_SECRET`, `GET`. Seleciona `clients` onde `contrato_status='pendente'` e `autentique_document_id is not null`, chama reconcile pra cada (com limite/throttle), retorna resumo `{checked, changed}`.
- **`src/app/api/admin/contracts/refresh/[id]/route.ts`** — refatorado pra só chamar `reconcileContractByClientId(id)` (mantém a resposta atual pro card). Zero mudança de comportamento visível.
- **Registro do webhook no Autentique** — helper `createWebhook`/config no painel apontando pra `/api/webhooks/autentique?token=...`. Verificar na doc GraphQL se é via mutation ou painel (§8, passo 5).

## 4. Mudanças de dados

Migration nova `2026xxxx_contract_autosign.sql`:

```sql
-- 1) Buscar cliente por documento (webhook) fica O(1)
create index if not exists clients_autentique_doc_idx
  on public.clients (autentique_document_id)
  where autentique_document_id is not null;

-- 2) Quando a assinatura foi detectada (pro card e pra ordenar)
alter table public.clients
  add column if not exists contrato_signed_at timestamptz;

-- 3) Bookkeeping do polling (evita reprocessar e ajuda debug)
alter table public.clients
  add column if not exists autentique_last_checked_at timestamptz;

comment on column public.clients.contrato_signed_at is
  'Quando o sistema detectou o contrato assinado (webhook ou polling). Null = ainda não.';
comment on column public.clients.autentique_last_checked_at is
  'Última vez que consultamos o Autentique pra este doc (polling/reconcile).';

-- 4) Permitir notificar o admin na assinatura
alter table public.admin_notifications
  drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications
  add constraint admin_notifications_kind_check
  check (kind in (
    'contrato.preenchido',
    'contrato.assinado',   -- NOVO
    'briefing.concluido',
    'pagamento.recebido',
    'outro'
  ));
```

Também estender o union `NotificationKind` em `src/lib/notifications.ts` com `"contrato.assinado"`. `contrato_status` **não** muda de enum — `assinado` já é valor válido.

## 5. Rotas/API e telas de UI

### `POST /api/webhooks/autentique` (novo, público)
- **Auth:** sem sessão. Duas camadas, o que o Autentique permitir (§7):
  - (a) token secreto na URL: `?token=<AUTENTIQUE_WEBHOOK_TOKEN>`, comparado com `timingSafeEqual`; **e/ou**
  - (b) se o Autentique assinar o corpo, validar HMAC no molde de `src/app/api/fysi/webhook/route.ts` (linhas 36–51).
- **Corpo:** parse defensivo. Procurar o id do documento em caminhos plausíveis (`document.id`, `object.id`, `data.document.id`) — resiliente a formato. Sem id reconhecível → `200 {ignored:true}` (não faz o Autentique re-tentar).
- **Ação:** `reconcileContractByDocumentId(id)`. Doc não mapeado a cliente → `200 {ignored:true}`.
- **Resposta:** `200 {ok:true, changed, status}`. Erros internos → 200 com `logged` (o polling cobre; evitar loop de retry do Autentique).

### `GET /api/cron/contracts-poll` (novo)
- **Auth:** header `Authorization: Bearer <CRON_SECRET>` (padrão Vercel Cron).
- **Query:** `contrato_status='pendente'` AND `autentique_document_id not null` (LIMIT ~50, ordenado por `autentique_last_checked_at` asc nulls first).
- Chama reconcile por item; grava `autentique_last_checked_at`. Retorna `{checked, changed}`.
- **Agendamento** em `vercel.json` (não existe hoje):
```json
{ "crons": [ { "path": "/api/cron/contracts-poll", "schedule": "*/15 * * * *" } ] }
```

### `POST /api/admin/contracts/refresh/[id]` (refatorada)
- Mantém contrato de resposta atual (`{ok, status, signedUrl, signers}`); passa a delegar ao helper. Botão "Atualizar status" do card continua funcionando como fallback manual.

### UI — `src/components/admin/contract-card.tsx`
Mudança mínima (sem redesenho):
- No bloco de contrato existente (`hasContract && !forceEditMode`, linhas 310+), abaixo do ID Autentique, mostrar:
  - selo discreto "Sincronização automática ativa" (informativo).
  - `contrato_signed_at` formatado quando presente ("Assinado em …").
- Manter os botões "Atualizar status" e "Marcar como assinado" (fallback).
- Requer passar `contratoSignedAt` como prop nova (a page `src/app/admin/[id]/page.tsx` já lê a linha do cliente; adicionar o campo ao select).

Nenhuma mudança na UI do cliente: `/api/me/stage` já expõe `contratoStatus`/`contratoSignedUrl`; a timeline reflete automaticamente.

### Env novas (documentar em `src/lib/env.ts` `getServerEnv`)
- `AUTENTIQUE_WEBHOOK_TOKEN` — segredo do token da URL do webhook.
- `CRON_SECRET` — bearer do cron.

## 6. Dependências de outras caixas

Esta é a **primeira caixa** e é auto-suficiente. As integrações downstream já existem — não são pré-requisitos:
- **Barramento outbound / app-financeiro**: `sendDashboardWebhook` + `/api/fysi/webhook` já roteiam `contrato.assinado`. Só passamos a disparar por gatilho automático além do manual.
- **Notificações admin**: reusa `admin_notifications` + `createAdminNotification` (só adiciona o kind `contrato.assinado`).
- **Timeline/estágio do cliente**: consome `contrato_status`, sem acoplamento novo.

Acoplamento soft (não bloqueia): se houver uma caixa futura de "avanço automático de etapa" ou "e-mails transacionais ao cliente", ela plugará no gate de transição do helper `reconcileContract*` (ponto único de extensão). Nada a fazer agora.

## 7. Riscos e decisões em aberto

- **Auto-avançar etapa — decisão de design (recomendação: NÃO).** "Assinatura de contrato" é atividade do stage 0 (Onboarding) em `buildTimeline`, não um stage. Incrementar `current_stage_index` na assinatura pularia briefing/chamada. Recomendo **não** mexer em `current_stage_index`; a assinatura fica visível via `contrato_status`. Se o time quiser um marcador, usamos `contrato_signed_at` (já na migration) sem tocar no índice.
- **Aut101 do webhook do Autentique:** incerteza sobre (a) suportar assinatura HMAC do corpo e (b) mecanismo de registro (painel vs. `createWebhook` GraphQL) e nomes exatos de evento. **Mitigado por design:** token secreto na URL + re-query via `getDocument()` como fonte da verdade → nomes/formato de evento são irrelevantes. Confirmar na doc no passo 5.
- **Idempotência & corrida webhook×polling:** ambos chamam o mesmo helper; o gate `previousStatus !== 'assinado'` garante um único outbound. Aceitável mesmo sem lock (janela de corrida minúscula; pior caso = 2 webhooks outbound, e o receiver `/api/fysi/webhook` já é tolerante). Se quiser blindar: `update ... where id = ? and contrato_status <> 'assinado'` e disparar outbound só se `rowCount>0`.
- **Segurança da rota pública:** sem token → alguém poderia forçar reconcile de doc arbitrário. Impacto baixo (só re-lê o Autentique e no máximo marca assinado o que o Autentique diz estar assinado), mas exigir token mesmo assim.
- **Custo do polling:** `*/15min` sobre poucos `pendente` é barato. LIMIT + `autentique_last_checked_at` evitam varrer tudo. Pode desligar o cron se o webhook provar-se confiável.
- **E-mail ao cliente na assinatura:** fora do escopo default; ponto de extensão pronto no helper se quiserem ligar depois.

## 8. Ordem de implementação (incremental, testável)

1. **Migration** (§4): índice em `autentique_document_id`, `contrato_signed_at`, `autentique_last_checked_at`, kind `contrato.assinado`. Testar: `list_tables`/select confirmam colunas e constraint.
2. **Extrair `src/lib/contracts.ts`** com `reconcileContractByClientId` + `reconcileContractByDocumentId` (mover lógica de `refresh/[id]/route.ts`, gravar `contrato_signed_at` no gate de transição, atualizar `autentique_last_checked_at`). Testável isolado com um `autentique_document_id` real em `pendente`.
3. **Refatorar `refresh/[id]/route.ts`** pra delegar ao helper. Regressão: botão "Atualizar status" no card segue idêntico. É o teste manual mais rápido do helper.
4. **`POST /api/webhooks/autentique`**: token + parse defensivo + reconcile. Testar com `curl` simulando payload (só precisa conter um id de doc válido) e sem token (401).
5. **Registrar o webhook no Autentique** apontando pra `/api/webhooks/autentique?token=…`; confirmar na doc GraphQL o mecanismo/eventos. Teste E2E real: assinar um contrato de teste e ver `contrato_status` virar `assinado` sozinho + notificação criada + outbound no log.
6. **`GET /api/cron/contracts-poll`** + `vercel.json`. Testar chamando a rota com o bearer; validar que um `pendente` já assinado (com webhook desligado de propósito) é reconciliado.
7. **UI do card** (`contract-card.tsx` + prop `contratoSignedAt` na page): selo "sincronização automática" + "Assinado em …". Manter fallbacks.
8. **Env & docs**: `AUTENTIQUE_WEBHOOK_TOKEN`, `CRON_SECRET` em `getServerEnv` e no README/Vercel.
