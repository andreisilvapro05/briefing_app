-- ============================================================
-- Moodboard — quadro tipo Padlet pra cliente revisar referências
-- e direções visuais antes do design.
--
-- moodboard_data: JSON com { titulo, descricao, items[], status,
--                            enviado_em }
-- ============================================================

alter table public.clients
  add column if not exists moodboard_data jsonb,
  add column if not exists moodboard_atualizado_at timestamptz;

comment on column public.clients.moodboard_data is
  'Moodboard do projeto — cards (imagem/link/nota/cor) com comentários do cliente.';
comment on column public.clients.moodboard_atualizado_at is
  'Última edição do moodboard (admin OU cliente).';
