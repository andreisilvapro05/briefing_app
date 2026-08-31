-- Liga a Caixa 0 (team_members, login por pessoa) ao sistema de
-- responsável por tarefa que já existia (TEAM_MEMBERS fixo em
-- src/lib/project-tasks.ts, gravado como texto em project_tasks.responsavel).
-- Sem essa ponte não dá pra saber "quais projetos são da Valéria" — usado
-- pra restringir o papel 'basico' aos clientes em que a pessoa tem
-- pelo menos uma tarefa atribuída.

alter table public.team_members add column if not exists task_value text;

comment on column public.team_members.task_value is
  'Liga esse membro ao valor usado em project_tasks.responsavel (ver TEAM_MEMBERS em src/lib/project-tasks.ts) — usado pra filtrar quais clientes um membro "basico" enxerga.';
