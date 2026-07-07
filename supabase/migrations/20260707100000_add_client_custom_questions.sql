-- Perguntas específicas por cliente.
--
-- Permite ao admin adicionar perguntas sob medida para um cliente. Elas
-- aparecem como um bloco extra ("Perguntas específicas") no briefing daquele
-- cliente. As RESPOSTAS reusam a tabela briefing_responses existente, com
-- field_id no formato "perguntas-especificas.<id-da-pergunta>".

create table if not exists public.client_custom_questions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,
  hint text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ccq_client
  on public.client_custom_questions(client_id);

-- RLS habilitada; sem policies. Acesso só via service-role: o admin gerencia
-- e o cliente lê via API que usa service-role. A anon key não acessa.
alter table public.client_custom_questions enable row level security;
