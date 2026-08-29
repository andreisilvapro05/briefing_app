-- ============================================================
-- project_tasks — tarefas internas de produção por projeto (cliente).
-- Instanciadas a partir de DEFAULT_PROJECT_TASKS (src/lib/project-tasks.ts)
-- quando o admin clica "Gerar tarefas do template". Fonte de verdade das
-- subtarefas internas — não visível ao cliente.
-- Ver docs/superpowers/specs/2026-07-06-caixa-2-tarefas-clickup-design.md
-- ============================================================
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,

  titulo text not null,
  ordem int not null default 0,

  status text not null default 'a-iniciar'
    check (status in (
      'parado', 'nem-comecou-nada', 'a-iniciar', 'onboarding',
      'redacao-copy', 'design-pagina', 'validacao-design-copy',
      'ajustes-design-copy', 'implementacao', 'validacao-implementacao',
      'ajuste-implementacao', 'otimizacao-entrega', 'completo-entregue'
    )),
  prioridade text
    check (prioridade is null or prioridade in ('urgente', 'alta', 'normal', 'baixa')),
  responsavel text,

  data_inicial date,
  data_vencimento date,
  concluida_em timestamptz,

  origem text not null default 'template'
    check (origem in ('template', 'manual')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_client_idx
  on public.project_tasks(client_id);
create index if not exists project_tasks_status_idx
  on public.project_tasks(status);

drop trigger if exists project_tasks_touch_updated_at on public.project_tasks;
create trigger project_tasks_touch_updated_at
  before update on public.project_tasks
  for each row execute function public.touch_updated_at();

-- RLS: só o service_role (backend) lê/escreve — sem policy pública, nega
-- tudo pra anon/authenticated. Cliente nunca vê tarefas internas.
alter table public.project_tasks enable row level security;

comment on table public.project_tasks is
  'Subtarefas internas de produção por cliente/projeto, geradas de um template por project_type. Ver Caixa 2.';
