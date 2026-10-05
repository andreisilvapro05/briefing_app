-- A ata é UM documento com VÁRIOS clientes dentro — não uma por cliente.
--
-- Karine (05/10): "a parte de ata, não é pra ser individual de cada cliente,
-- e sim tudo num documento só, poder puxar todos os clientes dentro de um
-- mesmo documento".
--
-- O que estava errado: a ata nasceu em 04/10 como `ei_documents` kind='ata'
-- COM `client_id` — uma ata por cliente por data. O gesto real do Andrei é
-- outro: ele senta uma vez (a reunião de segunda) e passa por TODOS os
-- projetos, anotando uma linha em cada. Uma ata por cliente obrigaria a
-- abrir 24 documentos pra fazer a reunião de uma semana.
--
-- Agora:
--   * `ei_documents` kind='ata' com `client_id` NULO = a reunião (título,
--     data em `referencia_em`, texto livre em `ei_data.blocks`).
--   * `ata_linhas` = um cliente dentro dessa ata, com a observação dele.
--
-- O STATUS continua NÃO sendo gravado: é lido de `clients.status` ao montar
-- a tela. É o que faz "quando ele muda o status para finalizado some dali"
-- funcionar sem escrita nenhuma, e evita dois status divergentes no dia em
-- que o sync do ClickUp mexer num e não no outro.
--
-- Nenhuma ata existia em produção quando isto rodou (conferido), então não
-- há dado a migrar.

create table if not exists public.ata_linhas (
  id uuid primary key default gen_random_uuid(),
  ata_id uuid not null references public.ei_documents(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  observacao text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- O mesmo cliente não entra duas vezes na mesma ata: a linha dele é uma,
  -- e "puxar de novo" tem que ser inofensivo.
  unique (ata_id, client_id)
);

create index if not exists ata_linhas_por_ata_idx
  on public.ata_linhas (ata_id, ordem);

-- RLS deny-all, como o resto do app: quem autoriza é o código, com
-- service-role. Sem policy nenhuma, nada passa pelo cliente anônimo.
alter table public.ata_linhas enable row level security;

comment on table public.ata_linhas is
  'Um cliente dentro de uma ata (ei_documents kind=ata, client_id nulo). O status NÃO mora aqui: sai de clients.status ao montar a tela.';
