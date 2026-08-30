-- Adiciona o status 'concluido' ao CHECK de project_tasks.status.
--
-- src/lib/project-tasks.ts (fix "adiciona status concluido e melhora
-- contraste do A iniciar") passou a oferecer 'concluido' no seletor de
-- status, mas o CHECK original (20260829120000_add_project_tasks.sql) não
-- incluía esse valor → updateProjectTaskAction falharia no banco ao salvar
-- uma tarefa com esse status.
--
-- Este arquivo espelha a migration já aplicada em produção (Supabase
-- project hwsiukyxkhvmtkbqlerx, versão 20260829224050) que não tinha sido
-- commitada no repo.

alter table public.project_tasks
  drop constraint if exists project_tasks_status_check;

alter table public.project_tasks
  add constraint project_tasks_status_check
  check (
    status in (
      'parado', 'nem-comecou-nada', 'a-iniciar', 'onboarding',
      'redacao-copy', 'design-pagina', 'validacao-design-copy',
      'ajustes-design-copy', 'implementacao', 'validacao-implementacao',
      'ajuste-implementacao', 'otimizacao-entrega', 'concluido',
      'completo-entregue'
    )
  );
