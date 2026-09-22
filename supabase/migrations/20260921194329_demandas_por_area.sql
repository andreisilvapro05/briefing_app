-- Demandas internas por ÁREA.
--
-- Pedido da Karine (2026-09-21): "a Tainá colocar demandas que chegam pra mim
-- mas que não são de projetos específicos". Hoje a demanda sem cliente existe
-- (client_id null), mas não tem onde ser classificada nem onde ser vista em
-- conjunto — ela se mistura ao trabalho de projeto em "Meu Trabalho".
--
-- `area` é NULO pra trabalho de projeto (o que pertence a um cliente) e
-- preenchido pro trabalho interno da agência.
alter table public.project_tasks
  add column if not exists area text;

alter table public.project_tasks
  drop constraint if exists project_tasks_area_check;
alter table public.project_tasks
  add constraint project_tasks_area_check
  check (area is null or area in (
    'comercial',
    'curso',
    'financeiro',
    'processos',
    'marketing'
  ));

-- A tela de Demandas lê por área + status; o índice cobre os dois.
create index if not exists project_tasks_area_idx
  on public.project_tasks (area, status) where area is not null;

comment on column public.project_tasks.area is
  'Área interna da agência (comercial, curso, financeiro, processos, marketing). NULL = trabalho de projeto, que pertence a um cliente.';
