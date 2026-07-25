-- Imagens nos cartões do quadro de conteúdo (kanban).
-- Array de URLs públicas (Supabase Storage). Default vazio.

alter table public.content_cards
  add column if not exists imagens jsonb not null default '[]'::jsonb;
