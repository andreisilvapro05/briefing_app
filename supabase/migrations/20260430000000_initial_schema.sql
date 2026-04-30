-- ============================================================
-- FYSI BRIEFING — Supabase Setup (Postgres + Storage + RLS)
--
-- COMO USAR:
--   1. Crie o projeto em supabase.com (região sa-east-1 / São Paulo).
--   2. No painel, vá em "SQL Editor" → "New query".
--   3. Cole TODO este arquivo e rode (botão "Run").
--   4. Confira em "Database → Tables" que clients, briefing_responses
--      e briefing_files apareceram.
--   5. Confira em "Storage → Buckets" que `briefing-uploads` existe e está público.
--
-- O script é idempotente — pode rodar múltiplas vezes sem quebrar.
-- ============================================================

-- ============================================================
-- TABELAS
-- ============================================================

-- 1. clients — registro de cada cliente que acessa o briefing.
--    auth_user_id é preenchido depois que o cliente confirma o magic link.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,

  -- Identificação (Tela 1)
  nome text not null,
  email text not null,
  empresa text not null,
  whatsapp text not null,

  -- Tipo de projeto (Tela 2)
  project_type text check (
    project_type in ('landing-com-copy', 'landing-sem-copy', 'site-completo')
  ),

  -- Status do briefing
  status text not null default 'em-andamento'
    check (status in ('nao-iniciado', 'em-andamento', 'concluido', 'abandonado')),

  -- Metadados de spam/auditoria
  ip_address inet,
  user_agent text,
  email_verified_at timestamptz,
  briefing_submitted_at timestamptz,
  clickup_task_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_email_idx on public.clients(email);
create index if not exists clients_status_idx on public.clients(status);
create index if not exists clients_auth_user_idx on public.clients(auth_user_id);

-- 2. briefing_responses — uma linha por campo respondido.
--    field_id usa o formato "{bloco_id}.{campo}" para ser único por cliente.
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

-- 3. briefing_files — referências para objetos no Storage.
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
-- TRIGGERS
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
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.clients enable row level security;
alter table public.briefing_responses enable row level security;
alter table public.briefing_files enable row level security;

-- Cliente vê e edita APENAS seu próprio registro.
drop policy if exists clients_self_select on public.clients;
create policy clients_self_select on public.clients
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists clients_self_update on public.clients;
create policy clients_self_update on public.clients
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- briefing_responses: cliente vê/edita só as próprias.
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

-- briefing_files: cliente vê/edita só os próprios.
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
-- A validação admin é feita server-side comparando auth.email() contra ADMIN_EMAILS.

-- ============================================================
-- STORAGE — Bucket para uploads do briefing
-- ============================================================

-- Cria bucket público (read-only via anon; write via service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'briefing-uploads',
  'briefing-uploads',
  true,
  26214400, -- 25 MB
  null      -- aceita qualquer MIME (logos, fontes, áudios, PDFs etc.)
)
on conflict (id) do nothing;

-- Política de leitura pública (necessária para os public_url funcionarem).
drop policy if exists "briefing_uploads_public_read" on storage.objects;
create policy "briefing_uploads_public_read" on storage.objects
  for select to public
  using (bucket_id = 'briefing-uploads');

-- Insert/update/delete: só permite operações no prefixo do próprio usuário.
-- O path no Storage tem formato `{auth_user_id}/{prefix}/{file}`, então a
-- primeira pasta precisa bater com auth.uid(). O backend (/api/upload) já
-- força isso, e a policy enforça via SQL.

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

-- ============================================================
-- AUTH — Configuração esperada
-- ============================================================
-- No painel: "Authentication → URL Configuration":
--   Site URL:        https://briefing.fysilab.com  (ou http://localhost:3000)
--   Redirect URLs:   https://briefing.fysilab.com/auth/callback
--                    http://localhost:3000/auth/callback
--
-- Em "Authentication → Email Templates" você pode customizar o texto do
-- magic link com a identidade Fysi (assunto, corpo, botão).
--
-- Em "Authentication → Providers":
--   Email → "Enable Email provider": ON
--   Email → "Confirm email": OFF (queremos magic link sem dupla confirmação)
--   Email → "Secure email change": ON
-- ============================================================

-- Pronto. Se chegou até aqui sem erro, o setup está completo.
