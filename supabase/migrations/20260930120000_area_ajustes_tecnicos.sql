-- Área "Ajustes técnicos" em project_tasks.area.
--
-- Karine (2026-09-30): "adicionar um novo tipo de área chamada ajustes
-- técnicos, para demandas aleatórias internas". É a gaveta do trabalho
-- interno que não pertence a nenhuma das cinco áreas do negócio.
--
-- O CHECK é a única cópia do conjunto no banco; a lista que a interface
-- usa vive em src/lib/project-tasks.ts (AREAS). As duas precisam andar
-- juntas, senão salvar a área nova volta erro do Postgres.

alter table public.project_tasks
  drop constraint if exists project_tasks_area_check;

alter table public.project_tasks
  add constraint project_tasks_area_check
  check (
    area is null
    or area = any (array[
      'comercial',
      'atendimento',
      'curso',
      'financeiro',
      'processos',
      'marketing',
      'ajustes-tecnicos'
    ])
  );
