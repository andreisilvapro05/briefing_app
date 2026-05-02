-- ============================================================
-- Adiciona campos de contrato e agendamento de chamada na tabela clients.
-- Suporta o novo fluxo: dashboard com 3 fases (contrato / chamada / briefing).
-- ============================================================

-- Dados pra contrato (preenchidos na nova tela /contrato)
alter table public.clients
  add column if not exists endereco text,
  add column if not exists cep text,
  add column if not exists rg text,
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists razao_social text,
  add column if not exists como_conheceu text,
  add column if not exists contrato_preenchido_at timestamptz;

-- Dados de agendamento (preenchidos na nova tela /agendar via Calendly)
alter table public.clients
  add column if not exists chamada_agendada_at timestamptz,
  add column if not exists chamada_data timestamptz,
  add column if not exists chamada_observacoes text;

-- Índices úteis pra filtros futuros no /admin
create index if not exists clients_contrato_idx
  on public.clients(contrato_preenchido_at);
create index if not exists clients_chamada_idx
  on public.clients(chamada_agendada_at);

comment on column public.clients.contrato_preenchido_at is
  'Marker de quando o cliente concluiu a tela /contrato. Null = ainda pendente.';
comment on column public.clients.chamada_agendada_at is
  'Marker de quando o cliente confirmou ter agendado a chamada via Calendly. Null = pendente ou pulado.';
comment on column public.clients.chamada_data is
  'Data/hora da chamada agendada (preenchida manualmente ou via webhook Calendly).';
