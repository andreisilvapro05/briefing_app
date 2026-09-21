-- Briefing deixa de ser aba da ficha e vira documento com identidade própria.
alter table ei_documents
  add column if not exists clickup_page_id text,
  add column if not exists share_token text,
  add column if not exists share_enabled boolean not null default false,
  add column if not exists share_created_at timestamptz,
  add column if not exists share_expires_at timestamptz,
  add column if not exists credenciais jsonb,
  add column if not exists origem text;

create unique index if not exists ei_documents_clickup_page_id_key
  on ei_documents (clickup_page_id) where clickup_page_id is not null;
create unique index if not exists ei_documents_share_token_key
  on ei_documents (share_token) where share_token is not null;

-- Um cliente pode ter VÁRIOS briefings; Estrutura Inicial continua 1 por cliente.
drop index if exists ei_documents_client_kind_unique;
create unique index if not exists ei_documents_client_ei_unique
  on ei_documents (client_id) where client_id is not null and kind = 'ei';
create index if not exists ei_documents_kind_updated_idx
  on ei_documents (kind, updated_at desc);

-- Vínculo das tarefas com o ClickUp (sync idempotente de responsável/status).
alter table project_tasks
  add column if not exists clickup_task_id text,
  add column if not exists clickup_sync_at timestamptz;
create unique index if not exists project_tasks_clickup_task_id_key
  on project_tasks (clickup_task_id) where clickup_task_id is not null;
create index if not exists project_tasks_responsavel_status_idx
  on project_tasks (responsavel, status);

-- Chaves de API só-leitura (GET /api/demandas). Guarda SHA-256, nunca a chave.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  token_hash text not null unique,
  member_id uuid references team_members(id) on delete cascade,
  responsavel text,
  escopo text not null default 'demandas:read',
  revogada_at timestamptz,
  last_used_at timestamptz,
  criada_por text,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_token_hash_idx on api_keys (token_hash)
  where revogada_at is null;
alter table api_keys enable row level security;
