-- ============================================================
-- Adiciona controle de stage do projeto + última atividade do cliente.
--
-- current_stage_index: 0-based index do stage atual no pipeline.
-- Stages dependem do project_type — labels resolvidas no frontend
-- via buildTimeline em src/lib/project-types.ts.
--
-- last_client_activity_at: última vez que o cliente fez algo
-- (briefing save, upload, submit). Distinto de updated_at que é
-- tocado também por updates administrativos.
-- ============================================================

alter table public.clients
  add column if not exists current_stage_index integer not null default 0;

create index if not exists clients_current_stage_idx
  on public.clients(current_stage_index);

alter table public.clients
  add column if not exists last_client_activity_at timestamptz not null default now();

comment on column public.clients.current_stage_index is
  '0-based index do stage atual no pipeline. Stages dependem do project_type — ver buildTimeline em src/lib/project-types.ts';
comment on column public.clients.last_client_activity_at is
  'Última vez que o cliente fez alguma ação (briefing save, upload, submit). Distinto de updated_at que reflete também updates do admin.';
