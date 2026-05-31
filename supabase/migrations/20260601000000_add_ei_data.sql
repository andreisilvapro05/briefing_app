-- ============================================================
-- Estrutura Inicial (EI) — documento estruturado da equipe Fysi
-- montar antes da produção, derivado parcialmente do briefing.
--
-- ei_data:        JSON com todos os campos do template EI
--                 (Dados de acesso, Drive, Logo, Fonte, Cores,
--                  Refs, 13 seções de copy, Rodapé).
-- ei_atualizado_at: timestamp da última edição.
-- ============================================================

alter table public.clients
  add column if not exists ei_data jsonb,
  add column if not exists ei_atualizado_at timestamptz;

comment on column public.clients.ei_data is
  'Estrutura Inicial do projeto — preenchida pela equipe a partir do briefing. JSON com seções dinâmicas.';
comment on column public.clients.ei_atualizado_at is
  'Timestamp da última atualização do EI.';
