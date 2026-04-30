# Security

Postura de segurança do **Fysi Briefing**.

## Reportar vulnerabilidades

Se encontrar uma vulnerabilidade, abra uma issue **privada** no GitHub (ou envie e-mail para `fysilabdigital@gmail.com`). Não exponha detalhes em issues públicas até o fix estar deployado.

## Secrets

**Arquivos sensíveis NÃO comitados:**

- `.env.local` — contém `SUPABASE_SERVICE_ROLE_KEY`, `CLICKUP_API_TOKEN`, `OPENAI_API_KEY`, `RESEND_API_KEY`. O `.gitignore` cobre `.env*` e o template é o `.env.example`.

**Service role key:**
- Usada apenas em código server-side (`src/app/api/**`, `src/app/admin/**/actions.ts`).
- Nunca importada por componente client (`"use client"`).
- O cliente browser usa apenas `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Modelo de ameaças

O app é **público por design** — qualquer cliente Fysi acessa o link. Os principais vetores:

| Vetor | Mitigação |
|---|---|
| **Spam de cadastros** em `/api/auth/start` | Captcha Turnstile **obrigatório em produção** (variável `NODE_ENV=production`). Em dev é opcional. |
| **Abuso de upload** (custo de storage) em `/api/upload` | Em produção, exige usuário autenticado. Limite de 25 MB. Allowlist de MIME types. Bucket é fixado pelo servidor (input do client é ignorado). |
| **Abuso de transcrição** (custo OpenAI) em `/api/transcribe` | Em produção, exige usuário autenticado. Limite de 25 MB e MIME `audio/*`. |
| **Path traversal** em uploads | `pathPrefix` é sanitizado e rejeitado se contém caracteres inválidos. Path final é prefixado com `auth.uid()`. |
| **Acesso cruzado entre clientes** | RLS no Postgres (`auth_user_id = auth.uid()`) e RLS no Storage (`(storage.foldername(name))[1] = auth.uid()::text`). |
| **Acesso ao painel admin** | Allowlist via env `ADMIN_EMAILS`. Verificado em `getAdminUser()` antes de qualquer query. |
| **Vazamento via mensagens de erro** | `errorResponse()` retorna apenas códigos genéricos em produção. Stacks/SQL errors ficam só nos logs do servidor. |
| **PII em logs** | `logServerError()` escreve só `err.message` — sem payloads brutos. |

## Endpoints — quem pode chamar

| Rota | Auth | Notas |
|---|---|---|
| `POST /api/auth/start` | Público | Captcha em produção. Cria registro `clients` + dispara magic link. |
| `POST /api/auth/resend` | Público | Sempre retorna 200 (não enumera contas). |
| `POST /api/auth/admin-login` | Público | Só envia OTP se o e-mail estiver em `ADMIN_EMAILS`. |
| `GET  /auth/callback` | Público | Troca `code` por sessão Supabase. |
| `POST /api/briefing/save` | **Autenticado** | Salva resposta única. Verifica ownership do `client_id`. |
| `POST /api/briefing/submit` | Público | Aceita submissão anônima (cliente envia mesmo sem clicar no magic link). **Vetor conhecido** — ver "Issues abertas". |
| `POST /api/upload` | **Autenticado em produção** | Em dev permite anônimo (modo demo). |
| `POST /api/transcribe` | **Autenticado em produção** | Em dev permite anônimo (modo demo). |
| `GET  /admin*` | Admin (allowlist) | Server Component checa `getAdminUser()` antes de renderizar. |

## RLS Policies

Aplicadas em `supabase/migrations/20260430000000_initial_schema.sql`:

- **`clients`**: cliente vê e atualiza apenas o próprio registro (`auth_user_id = auth.uid()`).
- **`briefing_responses`**: vê/edita só as próprias (via JOIN em `clients`).
- **`briefing_files`**: vê/edita só os próprios (via JOIN em `clients`).
- **Storage `briefing-uploads`**:
  - SELECT público (URLs são longas/imprevisíveis, mas leitura por path direto é permitida).
  - INSERT/UPDATE/DELETE só no próprio prefixo (`(storage.foldername(name))[1] = auth.uid()::text`).

O `service_role` bypassa RLS — usado pelo backend Next.js para criar clientes sem auth (no `/api/auth/start`) e pelo painel admin (após `getAdminUser()` validar permissão).

## Issues abertas (não-bloqueantes para o primeiro deploy)

Estas devem virar issues no GitHub e ser endereçadas em iterações seguintes:

1. **Rate limiting distribuído**
   `/api/auth/start`, `/api/transcribe`, `/api/upload`. Hoje só limites de tamanho e captcha. Em produção real, adicionar Vercel KV ou Upstash Redis com janela deslizante (ex: 5 req/min/IP).

2. **`/api/briefing/submit` aceita payloads anônimos**
   Por design (cliente envia mesmo sem clicar no magic link). Risco: spam de tasks ClickUp + e-mails pra `TEAM_EMAIL`. Mitigação futura: exigir `clientId` que bata com registro pré-criado em `/api/auth/start`, ou adicionar Turnstile aqui também.

3. **Demo branch no `/api/upload`**
   Em dev, anônimos podem subir arquivos. Path `demo/...` fica órfão (sem `client_id`). Não afeta produção mas deixa lixo em dev.

4. **`as never` casts no submit**
   5 ocorrências em `briefing/submit/route.ts`. Funcionam mas perdem type-safety. Trocar por tipos gerados via `supabase gen types typescript` em iteração futura.

5. **Helper `getAdminSupabase()`**
   Hoje os Server Components do `/admin` usam `service_role` direto. Funciona porque `getAdminUser()` valida antes, mas se alguém adicionar uma rota nova e esquecer o gate, vaza. Combinar num único helper.

## Atualizações de dependência

- `npm audit` deve passar sem `high`/`critical` antes de cada deploy.
- Renovate ou Dependabot recomendado para o repo no GitHub.

## Backup e recuperação

- Supabase faz backup automático do Postgres. Confirme a janela de retenção no painel.
- Storage não tem versionamento por padrão — em caso de necessidade, ative Object Versioning no bucket `briefing-uploads`.

## Compliance

- O app coleta e armazena PII (nome, e-mail, telefone, conteúdo do briefing). Em produção, considere:
  - Política de privacidade visível no rodapé
  - Mecanismo de "esquecer-me" (deletar registro `clients` cascade)
  - Aviso LGPD ao usar o link (Tela 1)
