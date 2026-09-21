-- Notificações de demanda por pessoa + dois CHECKs que travavam o app em
-- silêncio.

-- 1) project_tasks.origem só aceitava 'template' | 'manual', mas o sync do
--    ClickUp grava 'clickup'. Todo INSERT do sync violava o CHECK: mesmo com
--    CLICKUP_API_TOKEN configurado, o botão "Sincronizar" não criaria nada.
alter table public.project_tasks
  drop constraint if exists project_tasks_origem_check;
alter table public.project_tasks
  add constraint project_tasks_origem_check
  check (origem in ('template', 'manual', 'clickup'));

-- 2) admin_notifications.kind não aceitava 'projeto.novo', que o código
--    emite ao criar cliente — o aviso "Novo projeto" nunca foi gravado
--    (o insert é best-effort e o erro era engolido).
alter table public.admin_notifications
  drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications
  add constraint admin_notifications_kind_check
  check (kind in (
    'contrato.preenchido',
    'briefing.concluido',
    'pagamento.recebido',
    'projeto.novo',
    'outro'
  ));

-- 3) Caixa de entrada por pessoa — "te atribuíram uma demanda", "comentaram
--    na sua demanda", "mudaram o status/prazo". admin_notifications é um
--    aviso GLOBAL (um read_at pra todo mundo); aqui cada linha tem um
--    destinatário e é lida só por ele.
--
--    `recipient` é o valor de TEAM_MEMBERS (o mesmo texto gravado em
--    project_tasks.responsavel), não um FK de team_members: é por ele que a
--    demanda é roteada, e pessoa sem login (Tainá, externo) também recebe.
create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  kind text not null check (kind in (
    'tarefa.atribuida',
    'tarefa.comentario',
    'tarefa.status',
    'tarefa.prazo',
    'tarefa.clickup'
  )),
  task_id uuid references public.project_tasks(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  actor text,
  title text not null,
  message text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists member_notifications_inbox_idx
  on public.member_notifications (recipient, created_at desc)
  where read_at is null;

create index if not exists member_notifications_task_idx
  on public.member_notifications (task_id);

create index if not exists member_notifications_client_idx
  on public.member_notifications (client_id);

-- Só o servidor (service-role) lê e escreve. RLS sem policy = anon e
-- authenticated não enxergam nada pela API REST.
alter table public.member_notifications enable row level security;

comment on table public.member_notifications is
  'Caixa de entrada de demandas por pessoa (recipient = project_tasks.responsavel). Acesso só via service-role.';
