-- Três colunas que o CÓDIGO já usa e que nunca existiram no banco.
--
-- Achado no mapeamento de 26/09/2026. O app lê e escreve as três em
-- src/app/admin/[id]/page.tsx, src/app/admin/[id]/actions.ts e
-- src/app/entrega/[slug]/page.tsx — e a rota pública /entrega/[slug] faz
-- SELECT explícito delas, então respondia erro para todo mundo.
--
-- É a causa da reclamação da Karine de que "a visualização das etapas pelo
-- cliente é falha no dashboard dele": o Moodboard e o Documento de Entrega
-- existem como tela, não salvavam, e o cliente nunca via nada.
--
-- Aditivo e sem risco: colunas novas, anuláveis, sem default.

alter table public.clients
  -- Documento de Entrega (DEP) — JSON de blocos, mesmo formato do editor.
  add column if not exists entrega_documento jsonb,
  -- Gatilho que libera o documento no painel do cliente. Nulo = ainda não
  -- finalizado; a data diz quando a equipe liberou.
  add column if not exists entrega_finalizada_at timestamptz,
  -- Moodboard do projeto — JSON de imagens e referências.
  add column if not exists moodboard_data jsonb;
