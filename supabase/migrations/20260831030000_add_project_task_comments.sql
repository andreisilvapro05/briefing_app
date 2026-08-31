create table public.project_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index project_task_comments_task_id_idx on public.project_task_comments(task_id);

alter table public.project_task_comments enable row level security;
