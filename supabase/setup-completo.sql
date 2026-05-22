-- ============================================================
-- FYSI BRIEFING — SETUP COMPLETO DO BANCO (todas as migrações juntas)
--
-- Use este arquivo se precisar recriar o banco do zero num projeto
-- Supabase novo:
--   1. Crie o projeto em supabase.com (região São Paulo / sa-east-1).
--   2. Painel → SQL Editor → New query.
--   3. Cole TODO este arquivo e clique em Run.
--   4. Pegue em Settings → API: Project URL, anon key e service_role key
--      e atualize as variáveis na Vercel.
--
-- É idempotente — pode rodar várias vezes sem quebrar.
-- (Consolida as 4 migrações de supabase/migrations/.)
-- ============================================================

-- ============================================================
-- 1. TABELAS
-- ============================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,

  nome text not null,
  email text,
  empresa text,
  whatsapp text not null,

  project_type text check (
    project_type in ('landing-com-copy', 'landing-sem-copy', 'site-completo')
  ),

  status text not null default 'em-andamento'
    check (status in ('nao-iniciado', 'em-andamento', 'concluido', 'abandonado')),

  ip_address inet,
  user_agent text,
  email_verified_at timestamptz,
  briefing_submitted_at timestamptz,
  clickup_task_id text,

  -- Controle de pipeline + atividade
  current_stage_index integer not null default 0,
  last_client_activity_at timestamptz not null default now(),

  -- Dados de contrato (preenchidos em /contrato)
  endereco text,
  cep text,
  rg text,
  cpf text,
  cnpj text,
  razao_social text,
  como_conheceu text,
  contrato_preenchido_at timestamptz,

  -- Agendamento da chamada
  chamada_agendada_at timestamptz,
  chamada_data timestamptz,
  chamada_observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Caso a tabela já exista de uma versão antiga, garante as colunas novas:
alter table public.clients alter column email drop not null;
alter table public.clients alter column empresa drop not null;
alter table public.clients
  add column if not exists current_stage_index integer not null default 0;
alter table public.clients
  add column if not exists last_client_activity_at timestamptz not null default now();
alter table public.clients add column if not exists endereco text;
alter table public.clients add column if not exists cep text;
alter table public.clients add column if not exists rg text;
alter table public.clients add column if not exists cpf text;
alter table public.clients add column if not exists cnpj text;
alter table public.clients add column if not exists razao_social text;
alter table public.clients add column if not exists como_conheceu text;
alter table public.clients add column if not exists contrato_preenchido_at timestamptz;
alter table public.clients add column if not exists chamada_agendada_at timestamptz;
alter table public.clients add column if not exists chamada_data timestamptz;
alter table public.clients add column if not exists chamada_observacoes text;

create index if not exists clients_email_idx on public.clients(email);
create index if not exists clients_status_idx on public.clients(status);
create index if not exists clients_auth_user_idx on public.clients(auth_user_id);
create index if not exists clients_current_stage_idx on public.clients(current_stage_index);
create index if not exists clients_contrato_idx on public.clients(contrato_preenchido_at);
create index if not exists clients_chamada_idx on public.clients(chamada_agendada_at);

create table if not exists public.briefing_responses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  bloco_id text not null,
  field_id text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  unique(client_id, field_id)
);

create index if not exists briefing_responses_client_idx
  on public.briefing_responses(client_id);
create index if not exists briefing_responses_bloco_idx
  on public.briefing_responses(client_id, bloco_id);

create table if not exists public.briefing_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  field_id text not null,
  storage_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists briefing_files_client_idx
  on public.briefing_files(client_id);

-- ============================================================
-- 2. TRIGGERS
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
  before update on public.clients
  for each row execute function public.touch_updated_at();

drop trigger if exists responses_touch_updated_at on public.briefing_responses;
create trigger responses_touch_updated_at
  before update on public.briefing_responses
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 3. ROW-LEVEL SECURITY
-- ============================================================

alter table public.clients enable row level security;
alter table public.briefing_responses enable row level security;
alter table public.briefing_files enable row level security;

drop policy if exists clients_self_select on public.clients;
create policy clients_self_select on public.clients
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists clients_self_update on public.clients;
create policy clients_self_update on public.clients
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists responses_self_all on public.briefing_responses;
create policy responses_self_all on public.briefing_responses
  for all to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.auth_user_id = auth.uid()
    )
  );

drop policy if exists files_self_all on public.briefing_files;
create policy files_self_all on public.briefing_files
  for all to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.auth_user_id = auth.uid()
    )
  );

-- O service_role usado pelo backend Next bypassa RLS automaticamente.

-- ============================================================
-- 4. STORAGE — Bucket para uploads do briefing
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('briefing-uploads', 'briefing-uploads', true, 26214400, null)
on conflict (id) do nothing;

drop policy if exists "briefing_uploads_public_read" on storage.objects;
create policy "briefing_uploads_public_read" on storage.objects
  for select to public
  using (bucket_id = 'briefing-uploads');

drop policy if exists "briefing_uploads_self_insert" on storage.objects;
create policy "briefing_uploads_self_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'briefing-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "briefing_uploads_self_modify" on storage.objects;
create policy "briefing_uploads_self_modify" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'briefing-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'briefing-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "briefing_uploads_self_delete" on storage.objects;
create policy "briefing_uploads_self_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'briefing-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Pronto. Se rodou sem erro, o banco está completo.
