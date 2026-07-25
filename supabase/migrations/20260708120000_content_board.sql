-- Quadro de produção de conteúdo interna da Fysi (kanban tipo Trello).
--
-- Um quadro único (sem separar por cliente). Colunas editáveis + cartões que
-- se movem entre colunas. Só a equipe acessa (service-role no servidor); RLS
-- habilitada sem policies = bloqueia acesso via anon key.

create table if not exists public.content_columns (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.content_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.content_columns(id) on delete cascade,
  titulo text not null,
  descricao text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_cards_column_idx
  on public.content_cards (column_id, ordem);

alter table public.content_columns enable row level security;
alter table public.content_cards enable row level security;
