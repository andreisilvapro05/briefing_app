-- Responsável DO PROJETO — o gestor, não quem está com a etapa da vez.
--
-- Karine (28/09): "sempre mostra o Andrei como responsável principal —
-- gestor de projetos". No ClickUp é assim: a coluna Responsável da linha
-- do projeto traz o Andrei em praticamente todas, porque ele é o dono da
-- tarefa-mãe. Quem toca a etapa (Valéria no design, Karine na copy)
-- aparece nas SUBTAREFAS.
--
-- O app derivava esse nome da tarefa aberta que vence primeiro, então a
-- coluna trocava de pessoa conforme o projeto andava — e nunca mostrava
-- o gestor. Agora o projeto tem responsável próprio.
--
-- Sem default no banco de propósito: quem preenche é o sync (a partir do
-- responsável da tarefa-mãe no ClickUp) ou a equipe na tela. Um default
-- 'andrei' cravado aqui viraria mentira no dia em que outra pessoa
-- assumir a gestão.

alter table public.clients
  add column if not exists responsavel text;

comment on column public.clients.responsavel is
  'Gestor do projeto (valor de TEAM_MEMBERS). Vem do responsável da tarefa-mãe no ClickUp. Não confundir com project_tasks.responsavel, que é quem faz a etapa.';
