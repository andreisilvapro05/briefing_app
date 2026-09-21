-- Nem toda demanda é de cliente. A lista "Tarefas Gestão de projetos" do
-- ClickUp tem trabalho interno da agência, e o app não tinha onde guardar
-- porque client_id era obrigatório — por isso demandas reais não apareciam.
alter table project_tasks alter column client_id drop not null;

create index if not exists project_tasks_sem_cliente_idx
  on project_tasks (responsavel, status) where client_id is null;
