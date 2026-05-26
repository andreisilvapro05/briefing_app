-- ============================================================
-- Slug mágico pro link direto do cliente (sem senha).
--
-- Formato: <empresa-slugificada>-<8 chars aleatórios>
-- ex.: "kb-marketing-x7a2bfde"
--
-- Usado pela rota /painel/[slug] que hidrata localStorage do cliente
-- e leva direto pro /dashboard — sem login/código.
--
-- Único + indexado (busca por slug).
-- ============================================================

alter table public.clients
  add column if not exists magic_slug text unique;

create index if not exists clients_magic_slug_idx
  on public.clients(magic_slug);

comment on column public.clients.magic_slug is
  'Slug único pro link direto do cliente (rota /painel/<slug>). Gerado na criação.';

-- ============================================================
-- Link de revisão da copy — aparece no dashboard do cliente, na etapa
-- "Criação da copy" da timeline. Admin cola o link do doc/figma com a
-- copy pra cliente revisar.
-- ============================================================
alter table public.clients
  add column if not exists copy_review_link text;

comment on column public.clients.copy_review_link is
  'Link da copy pra cliente revisar (Google Doc, Figma, etc.). Admin cola no painel.';
