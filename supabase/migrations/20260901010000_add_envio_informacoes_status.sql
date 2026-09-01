alter table public.clients drop constraint clients_status_check;
alter table public.clients add constraint clients_status_check check (status = any (array['parado','nem-comecou-nada','a-iniciar','onboarding','envio-informacoes','redacao-copy','design-pagina','validacao-design-copy','ajustes-design-copy','implementacao','validacao-implementacao','ajuste-implementacao','otimizacao-entrega','concluido','completo-entregue']));

alter table public.project_tasks drop constraint project_tasks_status_check;
alter table public.project_tasks add constraint project_tasks_status_check check (status = any (array['parado','nem-comecou-nada','a-iniciar','onboarding','envio-informacoes','redacao-copy','design-pagina','validacao-design-copy','ajustes-design-copy','implementacao','validacao-implementacao','ajuste-implementacao','otimizacao-entrega','concluido','completo-entregue']));
