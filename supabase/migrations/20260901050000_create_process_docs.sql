create table if not exists public.process_docs (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null,
  audiencia text not null check (audiencia in ('equipe','cliente')),
  link text,
  descricao text,
  fonte text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists process_docs_audiencia_idx on public.process_docs (audiencia);
create index if not exists process_docs_categoria_idx on public.process_docs (categoria);

alter table public.process_docs enable row level security;
