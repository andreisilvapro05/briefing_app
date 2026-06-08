-- ============================================================
-- Cobranças mensais — clientes recorrentes (SEO, manutenção, hosting)
-- separado de payments one-off do contrato.
--
-- client_id é OPCIONAL: pode ter cobrança de cliente que nunca passou
-- pelo briefing_app (ex: contrato externo, parceria).
-- ============================================================

create table if not exists public.cobrancas_mensais (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  -- usado quando não tem client_id (cliente externo)
  nome text not null,
  empresa text,
  whatsapp text,
  email text,

  valor_mensal numeric(10, 2) not null check (valor_mensal > 0),
  dia_cobranca smallint not null check (dia_cobranca between 1 and 31),
  descricao text,
  ativa boolean not null default true,

  data_inicio date not null default current_date,
  data_fim date,

  -- histórico de pagamentos como JSONB:
  -- [{ id, mesReferencia: "2026-06", valorPago, pagoEm, forma, observacao }]
  historico jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cobrancas_mensais_ativa_idx
  on public.cobrancas_mensais (ativa, dia_cobranca);
create index if not exists cobrancas_mensais_client_idx
  on public.cobrancas_mensais (client_id)
  where client_id is not null;

comment on table public.cobrancas_mensais is
  'Cobranças mensais recorrentes (SEO, manutenção, hosting). Histórico de pagamentos em jsonb.';
