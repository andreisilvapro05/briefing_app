-- Datas DO PROJETO, vindas da tarefa-mãe do ClickUp.
--
-- Karine (28/09), comparando as duas telas: "esses devem estar em parados
-- e não está igual, e as datas".
--
-- A linha do projeto derivava início e vencimento da subtarefa aberta que
-- vence primeiro. Só que no ClickUp a data mora na tarefa-MÃE: "César"
-- tem 8/7/26 → 9/7/26 lá, e aqui as colunas apareciam vazias, porque
-- nenhuma subtarefa dele tem data. Todos os quatro projetos parados
-- estavam assim.
--
-- Mesma solução do responsável (migration 20260928140000): o projeto passa
-- a ter datas próprias, preenchidas pelo sync a partir da tarefa-mãe. A
-- derivação por subtarefa continua valendo como reserva, pra projeto que
-- não veio do ClickUp.

alter table public.clients
  add column if not exists data_inicial date,
  add column if not exists data_vencimento date;

comment on column public.clients.data_vencimento is
  'Vencimento do PROJETO, vindo da tarefa-mãe do ClickUp. Não confundir com project_tasks.data_vencimento, que é o prazo de cada etapa.';
