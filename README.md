# Fysi Briefing

Portal de onboarding da Fysi Lab. Substitui o briefing PDF por uma experiência web com identidade da marca, salvamento automático, gravação de áudio com transcrição e integração direta ao ClickUp.

> Conversão estruturada para negócios de alto nível. Onde estratégia, decisão e estética operam juntas.

## Features

- **Fluxo completo do cliente**: identificação → escolha de projeto → dashboard com timeline → 5 blocos de briefing → revisão → envio
- **Magic link auth** via Supabase, com retomada do briefing por e-mail
- **Salvamento automático** de cada campo (debounce de 600ms)
- **Upload de arquivos** para Supabase Storage (logos, fontes, fotos, prints)
- **Gravação de áudio** com transcrição via OpenAI Whisper para campos longos
- **Integração ClickUp** — cria tarefa estruturada na lista da Fysi a cada briefing concluído
- **E-mail automático** pro time (`fysilabdigital@gmail.com`) com o briefing inteiro formatado
- **Painel admin** com lista de clientes, status, briefing consolidado e ações (reenviar link, enviar pro ClickUp manualmente)
- **Identidade visual Fysi Lab** aplicada via tokens Tailwind 4 (paleta oficial + Inter)

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript em modo estrito
- Tailwind CSS 4
- Supabase (Auth + Postgres + Storage)
- OpenAI Whisper (transcrição de áudio)
- Resend (e-mails transacionais)
- ClickUp v2 (tarefas estruturadas)
- Cloudflare Turnstile (anti-spam — opcional)
- Zod (validação de payloads)

## Setup

### 1. Clonar e instalar

```bash
git clone <url-do-repo> briefing-app
cd briefing-app
npm install
```

### 2. Configurar variáveis de ambiente

Copie o `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

Mínimo necessário pra rodar (modo "Supabase only"):

| Variável | Onde achar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Painel Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesma tela acima |
| `SUPABASE_SERVICE_ROLE_KEY` | mesma tela (sob "service_role") — **NUNCA exponha no client** |
| `ADMIN_EMAILS` | E-mails (separados por vírgula) que terão acesso ao `/admin` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` em dev, domínio real em produção |

Ver detalhes completos no [`.env.example`](./.env.example).

### 3. Aplicar schema no Supabase

Crie um projeto em [supabase.com](https://supabase.com), depois rode a migration:

**Via Supabase CLI** (recomendado):

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <SEU_PROJECT_REF>
supabase db push
```

**Ou cole no SQL Editor do painel:** copie o conteúdo de [`supabase/migrations/20260430000000_initial_schema.sql`](./supabase/migrations/20260430000000_initial_schema.sql) e execute.

A migration cria as tabelas (`clients`, `briefing_responses`, `briefing_files`), as policies de RLS, o bucket `briefing-uploads` e as policies de Storage com ownership por path.

### 4. Configurar Auth no painel Supabase

Em **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (ou seu domínio)
- **Redirect URLs**: `http://localhost:3000/auth/callback` (e o de produção)

Em **Authentication → Providers → Email**:

- "Enable Email provider": **ON**
- "Confirm email": **OFF** (queremos magic link sem dupla confirmação)

### 5. Rodar localmente

```bash
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

## Estrutura

```
src/
├── app/
│   ├── page.tsx                  # Tela 1 — Identificação
│   ├── projeto/                  # Tela 2 — Escolha do tipo de projeto
│   ├── dashboard/                # Tela 3 — Painel do cliente (timeline + status)
│   ├── briefing/
│   │   ├── page.tsx              # Entry — redireciona pro 1º bloco
│   │   ├── [bloco]/              # Bloco dinâmico (1–5)
│   │   ├── revisao/              # Revisão antes do envio
│   │   └── concluido/            # Tela de sucesso
│   ├── admin/
│   │   ├── page.tsx              # Lista de briefings (allowlist por e-mail)
│   │   ├── [id]/                 # Briefing consolidado + ações
│   │   └── login/                # Magic link admin
│   ├── auth/
│   │   ├── callback/             # Callback do magic link
│   │   └── erro/                 # Página de erro de auth
│   ├── entrar/                   # Reentrada via magic link (cliente)
│   └── api/
│       ├── auth/                 # start, resend, admin-login
│       ├── briefing/             # save, submit
│       ├── upload/               # Upload pra Storage
│       └── transcribe/           # OpenAI Whisper
├── components/
│   ├── ui/                       # Button, Input, Textarea, RadioGroup, etc.
│   ├── brand/                    # FysiMark (logo SVG)
│   ├── layout/                   # Shell, ContentFrame
│   ├── timeline/                 # Timeline do projeto
│   └── briefing/                 # Componentes dos 5 blocos
├── lib/
│   ├── env.ts                    # Validação de envs
│   ├── supabase/                 # Browser + server clients
│   ├── briefing-schema.ts        # Metadados dos blocos
│   ├── briefing-labels.ts        # Labels humanas (compartilhada por ClickUp/email/admin)
│   ├── briefing-store.ts         # Hook de autosave
│   ├── clickup.ts                # Integração ClickUp
│   ├── email.ts                  # Templates + Resend
│   └── api-helpers.ts            # errorResponse, logServerError, isProduction
└── middleware.ts                 # Refresh de sessão Supabase
supabase/
├── config.toml                   # Config do Supabase CLI
├── migrations/                   # Schema versionado
└── seed.sql                      # Dados de teste (vazio por padrão)
```

## Modos de operação

O app foi projetado pra rodar em 3 modos:

| Modo | Quando | Comportamento |
|---|---|---|
| **Demo** | `.env.local` sem chaves Supabase | Persistência via localStorage; sem auth real; sem ClickUp/e-mail. Útil pra testar o fluxo visualmente. |
| **Dev** | `.env.local` com Supabase, `NODE_ENV !== "production"` | Banco real, endpoints aceitam alguns relaxamentos (ex: upload anônimo permitido). Captcha opcional. |
| **Production** | Deploy com `NODE_ENV=production` | Endpoints exigem auth, captcha obrigatório (`TURNSTILE_SECRET_KEY`), error messages genéricos. |

## Comandos

```bash
npm run dev      # dev server com Turbopack
npm run build    # build de produção (inclui type-check)
npm run start    # rodar build de produção
npm run lint     # eslint
```

## Deploy

Recomendado: **Vercel**.

1. Importa o repo no painel da Vercel
2. Adiciona todas as envs de `.env.local` em **Project → Settings → Environment Variables**
3. Faz deploy
4. No painel Supabase, atualiza **Authentication → URL Configuration**:
   - Site URL → seu domínio (ex: `https://briefing.fysilab.com`)
   - Redirect URLs → adiciona `https://briefing.fysilab.com/auth/callback`
5. Configura `NEXT_PUBLIC_APP_URL` na Vercel pra apontar pro domínio

## Segurança

Ver [SECURITY.md](./SECURITY.md) para a postura completa: secrets, endpoints públicos, RLS, rate limiting recomendado para produção.

## Licença

Privado · Fysi Lab.
