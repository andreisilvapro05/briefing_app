-- Área "Atendimento" nas demandas internas.
--
-- Pedido da Karine em 2026-09-22. O atendimento ao cliente gera trabalho que
-- não é de nenhum projeto específico ("responder a Fulana", "remarcar a
-- reunião", "cobrar o material"), e até agora caía em Comercial ou ficava de
-- fora — que é o mesmo que sumir.
alter table public.project_tasks
  drop constraint if exists project_tasks_area_check;
alter table public.project_tasks
  add constraint project_tasks_area_check
  check (area is null or area in (
    'comercial',
    'atendimento',
    'curso',
    'financeiro',
    'processos',
    'marketing'
  ));

comment on column public.project_tasks.area is
  'Area interna da agencia (comercial, atendimento, curso, financeiro, processos, marketing). NULL = trabalho de projeto, que pertence a um cliente.';
