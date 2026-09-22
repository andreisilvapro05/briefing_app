-- Status "Em andamento" nas demandas.
--
-- Pedido da Karine em 2026-09-22, com print da tela de Demandas internas:
-- "atualizar aba de cobrança" e "realizar pagamento prospera contabilidade"
-- ficavam em "A iniciar" mesmo depois de começadas, porque os outros 14
-- status são etapas de PROJETO de cliente (Onboarding, Redação/Copy, Design
-- da página...) e nenhum deles cabe numa demanda administrativa.
--
-- O status entra na taxonomia inteira, mas a tela de Demandas passa a
-- oferecer só a lista curta que faz sentido lá (ver TASK_STATUS_INTERNO em
-- src/lib/project-tasks.ts): Parado, A iniciar, Em andamento, Concluído.
alter table public.project_tasks drop constraint if exists project_tasks_status_check;
alter table public.project_tasks add constraint project_tasks_status_check
  check (status = any (array[
    'parado','nem-comecou-nada','a-iniciar','em-andamento','onboarding',
    'envio-informacoes','redacao-copy','design-pagina','validacao-design-copy',
    'ajustes-design-copy','implementacao','validacao-implementacao',
    'ajuste-implementacao','otimizacao-entrega','concluido','completo-entregue'
  ]));
