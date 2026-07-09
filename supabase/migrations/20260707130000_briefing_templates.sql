-- Templates de briefing reutilizáveis.
--
-- A equipe monta um briefing (conjunto de perguntas) uma vez e depois APLICA
-- a qualquer cliente — o "aplicar" copia as perguntas do template pra
-- client_custom_questions daquele cliente (que já é renderizado no briefing).
--
-- perguntas: jsonb array de { label, hint, tipo, opcoes, ordem }.

create table if not exists public.briefing_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  perguntas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Só a equipe acessa (via service-role no servidor). RLS habilitada sem
-- policies = bloqueia acesso via anon key.
alter table public.briefing_templates enable row level security;
