-- ============================================================
-- ei_documents — hub de "Estruturas Iniciais" (EI): um documento por
-- cliente + um Modelo fixo sem cliente associado (client_id null).
-- Substitui clients.ei_data como fonte de verdade (a coluna antiga
-- continua existindo, só deixa de ser lida pelo app).
-- Ver docs/superpowers/specs/2026-08-30-estruturas-iniciais-hub-design.md
-- ============================================================
create table if not exists public.ei_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,

  nome text,
  is_template boolean not null default false,
  ei_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- no máximo 1 documento por cliente
create unique index if not exists ei_documents_client_unique
  on public.ei_documents(client_id) where client_id is not null;

-- no máximo 1 Modelo
create unique index if not exists ei_documents_one_template
  on public.ei_documents(is_template) where is_template;

drop trigger if exists ei_documents_touch_updated_at on public.ei_documents;
create trigger ei_documents_touch_updated_at
  before update on public.ei_documents
  for each row execute function public.touch_updated_at();

alter table public.ei_documents enable row level security;

comment on table public.ei_documents is
  'Hub de Estruturas Iniciais (EI) — um documento por cliente + o Modelo (client_id null).';

-- Semeia o Modelo, se ainda não existir. O literal abaixo espelha o shape
-- de emptyEI()/emptySecao() em src/lib/ei-template.ts — Postgres não pode
-- chamar TS, então mantemos os dois em sincronia manualmente.
insert into public.ei_documents (nome, is_template, ei_data)
select 'Modelo', true, '{
  "dadosAcesso": "",
  "briefingLink": "",
  "driveLink": "",
  "logo": "",
  "imagens": "",
  "fonteLetra": "",
  "cores": "",
  "paginasReferencia": "",
  "referenciasGerais": "",
  "copyExterno": "",
  "menuTem": "",
  "secoes": [
    {
      "nome": "SEÇÃO 01",
      "obs": "",
      "ref": "",
      "titulo": "",
      "texto": "",
      "cta": ""
    }
  ],
  "rodape": ""
}'::jsonb
where not exists (select 1 from public.ei_documents where is_template);

-- Backfill idempotente: qualquer clients.ei_data já preenchido vira uma
-- linha aqui (hoje é um no-op — 0 de 35 clientes têm ei_data preenchido).
insert into public.ei_documents (client_id, ei_data, created_at, updated_at)
select c.id, c.ei_data,
  coalesce(c.ei_atualizado_at, now()),
  coalesce(c.ei_atualizado_at, now())
from public.clients c
where c.ei_data is not null
  and not exists (
    select 1 from public.ei_documents d where d.client_id = c.id
  );
