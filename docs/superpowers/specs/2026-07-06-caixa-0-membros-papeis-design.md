# Caixa 0 — Membros & Papéis (login por pessoa)

> Design doc. **Não implementa código de produção** — descreve arquitetura, dados e ordem de execução para revisão antes de codar.

## 1. Problema e estado atual

Hoje **todo mundo da Fysi entra com a mesma senha** e o sistema trata todos como uma
única identidade sintética `admin@fysilab`. Não há "quem fez o quê", nem como
notificar/atribuir por pessoa.

Estado real do código (arquivos citados são os lidos, não suposições):

- **`src/lib/admin.ts` → `getAdminUser()`**: resolve o admin por 3 caminhos e, em 2 deles,
  devolve a identidade fixa `{ email: "admin@fysilab", source: "password" | "url-key" }`
  (linhas 20-36). Só o caminho 3 (Supabase Auth + `env.adminEmails`) devolve o e-mail real
  (linhas 38-60). Essa função é o **único gate de admin** e é chamada em ~20 lugares
  (`src/app/admin/page.tsx:50`, `admin/[id]/page.tsx`, `admin/quadro`, `admin/contratos`,
  `admin/relatorios`, `admin/cobrancas`, `admin/actions.ts`, e várias rotas
  `src/app/api/admin/**`). Todo esse call-site espera hoje só `{ email, source }`.
- **`src/lib/admin-session.ts`**: sessão **stateless** por cookie `fysi-admin`. O token é
  `HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, "admin-session:v1")` (linhas 19-27) — **igual pra
  todo mundo**, não carrega identidade. `isPasswordValid()` compara contra
  `env.adminPassword` em time-constant (linhas 72-90).
- **`src/app/api/auth/admin-password/route.ts`**: recebe `{ password }`, valida e chama
  `setAdminSessionCookie()` (linhas 29-42). Não sabe quem é a pessoa.
- **`src/app/admin/login/page.tsx`**: form de senha única; no sucesso redireciona pra
  `/admin?key=<senha>` (linha 38) — a própria senha vira query param bookmarkável
  (workaround pra browsers que descartam cookie HttpOnly: Brave/Safari ITP). O `?key=` é
  propagado em todos os links internos (`admin/page.tsx:57-60`).
- **`src/lib/env.ts`**: `adminPassword` (default `fysi-2026`, linha 70), `adminEmails`
  (CSV → lista lowercase, linhas 89-92), `clientAccessCode` (login do cliente, linha 74).
- **`src/app/api/auth/admin-login/route.ts`** + **`src/app/auth/callback/route.ts`**: já
  existe um fluxo **magic link** para e-mails na allowlist `ADMIN_EMAILS`
  (`signInWithOtp`, `admin-login/route.ts:31-39`) e o callback troca `code` por sessão e
  liga `auth_user_id` ao cliente (`callback/route.ts:29-49`). **Ou seja, a fundação de auth
  por pessoa via Supabase já está meio construída** — só não é usada como padrão nem tem papéis.
- **`src/middleware.ts` / `src/lib/supabase/middleware.ts`**: o middleware só dá refresh da
  sessão Supabase (`updateSession` → `supabase.auth.getUser()`), **não faz guard nem
  autorização** (comentário explícito em `middleware.ts:34`).
- **`supabase/migrations/20260602000000_add_admin_notifications.sql`**: tabela
  `admin_notifications` é **global** — não tem coluna de destinatário. Toda notificação é
  "pro admin" genérico. Isso é exatamente o que a Caixa de notificação-por-membro precisará
  quebrar, e depende desta caixa.
- **`supabase/migrations/20260430000000_initial_schema.sql`**: `clients.auth_user_id` já
  referencia `auth.users(id)`; RLS de cliente usa `auth.uid()`. O comentário nas linhas
  165-166 diz que **a validação de admin é feita server-side** (service role bypassa RLS) —
  não há RLS de admin no banco hoje.

**Resumo do problema:** identidade única, sessão sem identidade, notificações/tarefas sem
dono. Sem "pessoa", nada de por-membro é possível.

## 2. Objetivo e escopo

**Objetivo:** cada pessoa da Fysi passa a ter uma identidade própria (via Supabase Auth) com
um **papel** — `equipe` ou `admin` (sócio) — e `getAdminUser()` passa a devolver *quem* é a
pessoa. Isso é a fundação (Caixa 0) para: notificações por membro, responsável por tarefa,
agenda por pessoa.

### Entra no escopo (YAGNI aplicado)

1. Tabela `team_members` (identidade + papel + status ativo) ligada a `auth.users`.
2. Evolução de `getAdminUser()` → `getCurrentMember()` devolvendo `{ id, email, name, role,
   source }`, **retrocompatível** (mantém `email`).
3. Login por pessoa reusando o **magic link Supabase que já existe** (`/api/auth/admin-login`
   + `/auth/callback`), agora como caminho padrão da tela de login.
4. **Compat de transição:** manter o login por senha compartilhada funcionando, resolvendo
   para um membro "sistema" com papel `admin` e flag `legacy`, para não quebrar ninguém no dia
   do deploy.
5. Helpers de papel: `isAdmin(member)`, e um guard reutilizável `requireMember(role?)`.
6. Tela mínima de **gestão de membros** (`/admin/membros`) visível só para `role = admin`:
   listar, convidar (dispara magic-link/invite), mudar papel, desativar.
7. Seed inicial de membros a partir de `ADMIN_EMAILS` (migração de dados).

### Fica de fora (YAGNI)

- **Permissões granulares / RBAC por recurso.** Só dois papéis. Nada de matriz de permissões.
- **Login email+senha, reset de senha, MFA.** Reusa magic link; não cria superfície nova.
- **Convite com aceite/onboarding elaborado.** Convite = criar linha + disparar magic link.
- **RLS de admin no Postgres.** O backend continua usando service role + guard no server
  (mantém o modelo atual de `admin.ts`). Migrar autorização pra RLS é outra caixa.
- **Notificações/tarefas/agenda por membro em si.** Esta caixa só entrega a *fundação* (a
  coluna/relação de "membro"); as features consomem depois.
- **Auditoria/histórico de ações por membro.** Fora do MVP.
- **Remover o `?key=` na URL.** Continua existindo como fallback; só deixa de ser a senha
  compartilhada e passa a ser um token curto por sessão (ver Riscos).

## 3. Design proposto

### 3.1 Identidade = Supabase Auth (não reinventar)

Reusamos o Supabase Auth já configurado. Uma pessoa da Fysi = um `auth.users` (criado via
magic link / invite). A camada de papel/perfil vive numa tabela nova `team_members` **1:1 com
`auth.users`**, análoga a como `clients.auth_user_id` já liga cliente ↔ auth.

Por que não uma tabela de "usuários" própria com senha: o app já tem `@supabase/ssr`
cookmoteado (middleware, server client), o fluxo magic link já existe e funciona, e evita
guardar hash de senha. Menos superfície, menos código.

### 3.2 Camada de sessão/identidade (o coração da mudança)

Novo módulo **`src/lib/member.ts`** (evolução de `admin.ts`):

```
type Member = {
  id: string;            // team_members.id
  authUserId: string|null;
  email: string;         // mantém compat com getAdminUser().email
  name: string;
  role: "admin" | "equipe";
  source: "supabase" | "password-legacy" | "url-key-legacy";
  legacy: boolean;       // true quando entrou pela senha compartilhada
};

getCurrentMember(opts?): Promise<Member | null>
requireMember(role?): Promise<Member>   // throws/redirect se faltar
isAdmin(m): boolean
```

Ordem de resolução em `getCurrentMember()` (espelha a de `admin.ts` hoje, `admin.ts:19-60`):

1. **Supabase Auth** (caminho preferido agora): `supabase.auth.getUser()` → busca
   `team_members` por `auth_user_id`. Se existe e `active` → devolve o membro real
   (`source: "supabase"`, `legacy: false`).
2. **Cookie de senha compartilhada** (`hasValidAdminSession()`): devolve um **membro legado
   sintético** `{ email: "admin@fysilab", name: "Equipe Fysi (sessão compartilhada)", role:
   "admin", source: "password-legacy", legacy: true }`. Mantém o app inteiro funcionando no
   deploy.
3. **`?key=` na URL**: idem legado (`source: "url-key-legacy"`). Ver Riscos sobre trocar a
   senha crua por token curto.

`getAdminUser()` **permanece exportado** como um wrapper fino
(`return getCurrentMember(opts)` mapeado pra `{ email, source }`) para **não tocar os ~20
call-sites de uma vez** — eles migram incrementalmente.

### 3.3 Fluxo de dados (login por pessoa)

```
Pessoa → /admin/login → digita e-mail
  → POST /api/auth/member-login (evolução de admin-login/route.ts)
      → valida e-mail contra team_members(active) [em vez de env.adminEmails]
      → supabase.auth.signInWithOtp(emailRedirectTo=/auth/callback?next=/admin)
  → e-mail (Resend/Supabase) com magic link
  → /auth/callback → exchangeCodeForSession → liga auth_user_id em team_members
      (mesma mecânica de callback/route.ts:36-49, mas na tabela team_members)
  → redirect /admin  → getCurrentMember() devolve a pessoa real
```

O form de senha compartilhada continua disponível como "entrar com senha da equipe" (link
secundário) durante a transição.

### 3.4 Componentes de UI

- `src/app/admin/login/page.tsx`: passa a ter **dois modos** — (a) e-mail (magic link, padrão)
  e (b) senha da equipe (legado, colapsado atrás de "Acessar com senha compartilhada").
- `src/app/admin/membros/page.tsx` (novo, guard `requireMember("admin")`): tabela de membros +
  ações. Reusa `Shell`/`ContentFrame`/`Button`/`Input` já existentes.
- Header do admin: mostrar nome/papel do membro logado e link "Sair" apontando pro logout
  correto (Supabase signOut quando `source=supabase`; `clearAdminSessionCookie` quando legado).

## 4. Mudanças de dados

Nova migration `supabase/migrations/20260707000000_add_team_members.sql`:

```sql
-- Papel da pessoa no time
create type public.team_role as enum ('admin', 'equipe');

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,            -- lowercase; usado no login e no seed
  name text not null,
  role public.team_role not null default 'equipe',
  active boolean not null default true,  -- desativar sem apagar (preserva histórico futuro)
  invited_at timestamptz,                -- quando o magic link/invite foi disparado
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_email_idx on public.team_members (lower(email));
create index if not exists team_members_active_idx on public.team_members (active) where active;

drop trigger if exists team_members_touch on public.team_members;
create trigger team_members_touch before update on public.team_members
  for each row execute function public.touch_updated_at();  -- reusa fn do schema inicial

-- RLS: leitura/escrita só via service role (padrão atual do app). Habilita RLS
-- sem policy pública -> nega tudo pra anon/authenticated; backend usa service role.
alter table public.team_members enable row level security;

comment on table public.team_members is
  'Membros da Fysi com papel (admin=sócio, equipe). Fundação de login por pessoa (Caixa 0).';
```

**Seed (migração de dados)** — inserir os e-mails de `ADMIN_EMAILS` como `role='admin'`,
`active=true`. Pode ser um `insert ... on conflict do nothing` na própria migration se a lista
for conhecida, ou um script `scripts/seed-members.ts` lendo a env (evita hardcode). Como
`ADMIN_EMAILS` hoje é a fonte de verdade dos sócios, esse é o mapeamento natural.

**Preparação para as próximas caixas** (colunas que *elas* vão adicionar, citadas só para
mostrar que a fundação encaixa — **não** entram nesta migration):
`admin_notifications.member_id uuid references team_members(id)` (notificação por membro),
`clients.owner_member_id` ou `tasks.assignee_member_id` (responsável), `agenda.member_id`.

## 5. Rotas / API e telas

| Rota | Tipo | Mudança |
|---|---|---|
| `POST /api/auth/member-login` | API | Evolui `admin-login/route.ts`: valida contra `team_members(active)` em vez de `env.adminEmails`; dispara magic link; grava `invited_at`. |
| `GET /auth/callback` | API | Adiciona: além de ligar `clients.auth_user_id`, liga `team_members.auth_user_id` e seta `last_login_at` quando o e-mail bate um membro. |
| `POST /api/auth/admin-password` | API | Inalterado (compat). Continua setando o cookie legado. |
| `GET/POST /api/auth/admin-logout` | API | Passa a fazer `supabase.auth.signOut()` **e** `clearAdminSessionCookie()` (cobre os dois modos). |
| `GET /admin/membros` | Página | Nova. Guard `requireMember("admin")`. Lista membros. |
| `POST /api/admin/members` | API | Nova. Criar/convidar membro (admin-only): insere linha + dispara magic link. |
| `PATCH /api/admin/members/[id]` | API | Nova. Mudar `role`/`active` (admin-only). |
| `/admin/login` | Página | Dois modos (e-mail padrão + senha legado). |

Todas as rotas `/api/admin/**` e páginas `/admin/**` continuam chamando o gate; só trocam
`getAdminUser` → `getCurrentMember`/`requireMember` conforme migram.

## 6. Dependências de outras caixas

- **Nenhuma dependência de entrada.** Esta é a Caixa 0 / fundação.
- **É pré-requisito de:** Caixa de *notificações por membro* (precisa de `team_members.id`
  para `admin_notifications.member_id`), Caixa de *responsável por tarefa* (assignee =
  `team_members.id`, e idealmente mapear pra assignee do ClickUp — `clients.clickup_task_id`
  já existe), Caixa de *agenda por pessoa*.
- Integrações existentes (ClickUp/Autentique/Resend/Drive/OpenAI) **não são tocadas** aqui,
  exceto que o magic link pode usar o Resend/SMTP já configurado do Supabase.

## 7. Riscos e decisões em aberto

1. **Senha compartilhada na URL (`?key=`)**: hoje o `?key=` é a **senha crua**
   (`login/page.tsx:38`). Enquanto o modo legado existir, isso continua. Recomendação: no
   modo por pessoa, **não** usar `?key=`; e, para o legado, trocar a senha crua por um token
   de sessão curto e opaco (não a senha) — melhoria pequena mas reduz vazamento. Decisão:
   fazer agora ou adiar? (Não bloqueia a fundação.)
2. **Cookie legado é global e stateless** (`admin-session.ts:19-27`): não dá pra revogar por
   pessoa. Aceitável enquanto é o "modo transição". O corte é desligar `ADMIN_PASSWORD`.
3. **Guard fica no server (não RLS)**: mantém o modelo atual (service role bypassa RLS,
   validação no `admin.ts`). Migrar autorização de admin pra RLS é fora do escopo — risco de
   escopo se alguém quiser "segurança no banco" agora.
4. **Provisionamento**: quem cria o primeiro admin? O seed a partir de `ADMIN_EMAILS` resolve
   o bootstrap; depois, admins convidam pela UI. Precisa confirmar a lista real de sócios.
5. **Magic link vs senha para a equipe**: o spec assume magic link (reusa infra). Se a equipe
   preferir senha, é outra superfície (reset, confirm email) — mudaria o esforço.

## 8. Ordem de implementação (incremental e testável)

Cada passo é mergeável sem quebrar o app (o modo legado continua vivo até o passo 7).

1. **Migration `team_members` + enum + RLS + seed** a partir de `ADMIN_EMAILS`. *Teste:*
   `select` retorna os sócios como `admin`.
2. **`src/lib/member.ts`**: `getCurrentMember`, `requireMember`, `isAdmin`; e `getAdminUser`
   vira wrapper fino. *Teste:* com cookie legado → membro `legacy admin`; com sessão Supabase
   de um e-mail seedado → membro real. App inteiro continua passando (wrapper preserva shape).
3. **`/auth/callback`**: ligar `team_members.auth_user_id` + `last_login_at`. *Teste:* magic
   link de membro → linha ligada.
4. **`POST /api/auth/member-login`** (valida contra `team_members`) + **tela de login com
   modo e-mail**. *Teste:* e-mail de membro recebe link; e-mail fora da tabela → resposta
   genérica (mesma proteção de `admin-login/route.ts:25-28`).
5. **`admin-logout`** cobre os dois modos (signOut + clear cookie). *Teste:* sair encerra
   ambos.
6. **`/admin/membros` + APIs `POST /api/admin/members` e `PATCH .../[id]`** (admin-only via
   `requireMember("admin")`). *Teste:* admin convida/desativa; `equipe` recebe 403.
7. **Migrar call-sites** `getAdminUser` → `getCurrentMember`/`requireMember` gradualmente e,
   quando todos usarem identidade real, **anunciar o corte** do `ADMIN_PASSWORD** (remover
   default `fysi-2026` de `env.ts:70` e, por fim, o caminho legado).

Depois do passo 7, as caixas de notificação/responsável/agenda têm `team_members.id` como
âncora e podem começar.
