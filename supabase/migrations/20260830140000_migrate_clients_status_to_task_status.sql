-- Migra clients.status do enum antigo de 5 valores (nao-iniciado/em-andamento/
-- parado/concluido/abandonado) para a mesma taxonomia de 14 valores de
-- TaskStatus (src/lib/project-tasks.ts) usada por project_tasks.status — os
-- status reais do ClickUp da equipe. Fecha a lacuna apontada pelo usuário:
-- no ClickUp o status do projeto principal já usa essa taxonomia, não um
-- enum simplificado à parte.
--
-- Dados confirmados antes da migration (2026-08-30): só em-andamento (24) e
-- concluido (11) — nada usa nao-iniciado/parado/abandonado hoje.

-- 1. Remove o CHECK antigo (os novos valores de destino não cabem nele).
alter table public.clients
  drop constraint if exists clients_status_check;

alter table public.clients
  alter column status drop default;

-- 2. Migra os dados.

-- concluido (projeto entregue) -> completo-entregue (status terminal da
-- nova taxonomia). Mapeamento 1:1, sem ambiguidade.
update public.clients
  set status = 'completo-entregue'
  where status = 'concluido';

-- em-andamento -> status real da tarefa "atual" do cliente: a primeira
-- tarefa (por ordem) ainda não fechada, ou a última se todas fechadas
-- (mesma lógica de currentProductionStatus() em project-tasks.ts). Cliente
-- sem nenhuma tarefa cai no default da coluna (a-iniciar).
update public.clients c
  set status = coalesce(
    (
      select pt.status
      from public.project_tasks pt
      where pt.client_id = c.id
        and pt.status not in ('concluido', 'completo-entregue')
      order by pt.ordem asc
      limit 1
    ),
    (
      select pt.status
      from public.project_tasks pt
      where pt.client_id = c.id
      order by pt.ordem desc
      limit 1
    ),
    'a-iniciar'
  )
  where c.status = 'em-andamento';

-- Defensivo — hoje 0 linhas usam esses valores, mas garante que a migration
-- não quebra se isso mudar entre o design e a aplicação.
update public.clients set status = 'a-iniciar' where status = 'nao-iniciado';
update public.clients set status = 'parado' where status = 'abandonado';
-- status = 'parado' não precisa migrar: já é um valor válido na nova taxonomia.

-- 3. Novo default + novo CHECK, nos 14 valores de TaskStatus.
alter table public.clients
  alter column status set default 'a-iniciar';

alter table public.clients
  add constraint clients_status_check
  check (
    status in (
      'parado',
      'nem-comecou-nada',
      'a-iniciar',
      'onboarding',
      'redacao-copy',
      'design-pagina',
      'validacao-design-copy',
      'ajustes-design-copy',
      'implementacao',
      'validacao-implementacao',
      'ajuste-implementacao',
      'otimizacao-entrega',
      'concluido',
      'completo-entregue'
    )
  );
