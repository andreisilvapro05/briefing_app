-- Caixa 0 — Membros & Papéis (login por pessoa). Fundação: cada pessoa da
-- Fysi passa a ter identidade própria via Supabase Auth + um papel. Login
-- por senha compartilhada continua funcionando em paralelo durante a
-- transição — ver docs/superpowers/specs/
-- 2026-07-06-caixa-0-membros-papeis-design.md.
--
-- `role` é texto + CHECK (não enum Postgres) de propósito: a equipe tem 4
-- níveis hoje (admin/avancado/basico/desenvolvedor reservado) e o usuário
-- confirmou que isso vai crescer — um CHECK aceita novo valor com um ALTER
-- simples, um enum exigiria migration mais cara toda vez.

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,            -- lowercase; usado no login e no seed
  name text not null,
  role text not null default 'basico'
    check (role in ('admin', 'avancado', 'basico', 'desenvolvedor')),
  active boolean not null default true,  -- desativar sem apagar (preserva histórico futuro)
  invited_at timestamptz,                -- quando o magic link/invite foi disparado
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_members_email_idx on public.team_members (lower(email));
create index team_members_active_idx on public.team_members (active) where active;

create trigger team_members_touch before update on public.team_members
  for each row execute function public.touch_updated_at();

-- RLS: leitura/escrita só via service role (padrão atual do app). Habilita
-- RLS sem policy pública -> nega tudo pra anon/authenticated; backend usa
-- service role.
alter table public.team_members enable row level security;

comment on table public.team_members is
  'Membros da Fysi com papel (admin=sócio, avancado=acesso completo não-sócio, basico=acesso restrito por projeto atribuído, desenvolvedor=reservado). Fundação de login por pessoa (Caixa 0).';
comment on column public.team_members.role is
  'admin: sócio, acesso total. avancado: acesso completo sem ser sócio (ex: atendimento). basico: acesso restrito aos projetos em que a pessoa está marcada (enforcement ainda não implementado no código). desenvolvedor: reservado pra uso futuro.';
