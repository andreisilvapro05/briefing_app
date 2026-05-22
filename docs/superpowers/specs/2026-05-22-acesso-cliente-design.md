# Acesso do cliente — login por telefone + código global

Data: 2026-05-22 · Branch: `fix/acesso-cliente`

## Problema

O app foi construído para autenticação por magic-link (Supabase Auth), mas o
fluxo real (Tela 1: nome + WhatsApp, sem e-mail) **nunca cria sessão Auth**.
Consequências:

1. `/api/briefing/save` exige `supabase.auth.getUser()` → sempre 401 → as
   respostas do briefing ficam só no `localStorage`, nunca no banco.
2. Sem login real: a identidade é o `localStorage` do navegador. A Tela 1
   redireciona direto pro `/dashboard` e trava — não dá pra começar um briefing
   novo, nem reentrar de outro aparelho, nem outra pessoa acessar.
3. A tabela `briefing_responses` fica vazia → o admin não vê o que foi
   preenchido.

## Decisões (confirmadas com o cliente)

- Login = **telefone (WhatsApp) + um código global único** para o app todo,
  guardado na env `CLIENT_ACCESS_CODE`. Sem migração de banco.
- Casos a cobrir: reentrar de outro aparelho, convidar um sócio, começar um
  briefing do zero (cliente novo no mesmo navegador OU novo projeto).
- Fase 2 inclui sincronizar as respostas do briefing entre aparelhos.

## Design

### Persistência por `clientId` (correção de raiz)
Trocar a base da persistência de "sessão Supabase Auth" para o `clientId`
(UUID real da tabela `clients`, alta entropia — mesmo modelo já usado por
`/api/me/stage`).

- `POST /api/briefing/save` — reescrito: aceita `{ clientId, blocoId, fieldId,
  value }`, grava via service role em `briefing_responses`. Sem Auth.
- `POST /api/briefing/load` — novo: `{ clientId }` → devolve todas as respostas
  do cliente como mapa `{ "bloco.field": value }`.

### Login por telefone + código
- `POST /api/auth/login` — novo: `{ whatsapp, code }`. Valida `code` contra
  `CLIENT_ACCESS_CODE` (comparação time-constant + delay anti brute-force).
  Procura cliente por WhatsApp normalizado (só dígitos). Devolve
  `{ id, nome, whatsapp, empresa, email, projectType }` ou 404.
- `/entrar` — reescrito: formulário WhatsApp + Código. No sucesso, hidrata o
  `localStorage` (cliente + respostas via `/api/briefing/load`) e vai pro painel.

### Começar do zero / Sair
- Tela 1 (`/`): se já há briefing no `localStorage`, em vez de redirecionar
  automático, mostra escolha — "Continuar [empresa]" ou "Começar um briefing
  novo" (limpa tudo). Link visível para `/entrar`.
- Dashboard: botão "Sair" (limpa o `localStorage`).
- Robustez: se o dashboard não resolver o `projectType`, manda pro `/projeto`
  em vez de travar em "Carregando…".

### Fase 2 — sincronizar respostas
`/entrar` e o dashboard chamam `/api/briefing/load` e populam o
`localStorage` de respostas. Assim um sócio "continua de onde parou".

## Arquivos
Novos: `api/auth/login/route.ts`, `api/briefing/load/route.ts`.
Reescritos: `api/briefing/save/route.ts`, `app/entrar/page.tsx`.
Editados: `lib/briefing-store.ts`, `lib/storage.ts`, `app/page.tsx`,
`app/dashboard/page.tsx`, `lib/env.ts`, `.env.example`.

## Fora de escopo
- Não há migração de banco (tabelas já existem; código global vai em env).
- Sincronizar uploads de arquivo entre aparelhos (já têm `public_url`; ok).
