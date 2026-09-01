create table if not exists public.marketing_goals (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  meta numeric not null default 0,
  atual numeric not null default 0,
  unidade text,
  mes_referencia text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_goals_mes_idx on public.marketing_goals (mes_referencia);

create table if not exists public.marketing_plano_itens (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  mes_referencia text not null,
  status text not null default 'planejado' check (status in ('planejado','em-andamento','feito')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_plano_mes_idx on public.marketing_plano_itens (mes_referencia);

alter table public.marketing_goals enable row level security;
alter table public.marketing_plano_itens enable row level security;
