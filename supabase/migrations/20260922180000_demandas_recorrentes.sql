-- Demanda interna que se repete.
--
-- Pedido da Karine em 2026-09-22: "adicionar tarefas recorrentes na parte de
-- demandas internas da Tainá". O trabalho da Tainá tem muita coisa de
-- cadência — conferir pagamentos, postar conteúdo, mandar o relatório da
-- semana — e hoje cada uma dessas precisa ser digitada de novo toda vez, ou
-- fica aberta pra sempre depois de feita.
--
-- POR QUE "clonar ao concluir" e não um agendador:
-- o app não tem cron (o projeto não está na conta Vercel dela, ver
-- memory/limitacao_vercel_briefing_app.md), e gerar a próxima ocorrência ao
-- ABRIR a tela seria efeito colateral num GET — o <Link> do Next faz
-- prefetch e criaria demanda sozinho. Então a próxima nasce no momento em
-- que a atual é concluída, que é uma escrita que já existe.
--
-- Efeito colateral disso, e ele é DESEJÁVEL: se a ocorrência da semana
-- passada não foi concluída, a próxima não aparece. Fica uma só, vencida,
-- olhando pra pessoa — em vez de quatro cópias empilhadas.
alter table public.project_tasks
  add column if not exists recorrencia text,
  -- Id da demanda que gerou esta. Serve pra ver a série e pra não entrar em
  -- laço se alguém reabrir e concluir a mesma ocorrência várias vezes.
  add column if not exists recorrencia_origem uuid
    references public.project_tasks(id) on delete set null;

alter table public.project_tasks
  drop constraint if exists project_tasks_recorrencia_check;
alter table public.project_tasks
  add constraint project_tasks_recorrencia_check
  check (recorrencia is null or recorrencia in (
    'diaria',
    'semanal',
    'quinzenal',
    'mensal'
  ));

-- Uma ocorrência só por série e por data: se a mesma demanda for concluída
-- duas vezes (reabrir e fechar), a segunda não cria uma cópia. É a guarda
-- que torna a geração idempotente sem depender do código acertar sempre.
create unique index if not exists project_tasks_recorrencia_ocorrencia_idx
  on public.project_tasks (recorrencia_origem, data_vencimento)
  where recorrencia_origem is not null;

comment on column public.project_tasks.recorrencia is
  'Cadencia da demanda interna: diaria, semanal, quinzenal, mensal. NULL = nao repete. A proxima ocorrencia nasce quando a atual e concluida.';
comment on column public.project_tasks.recorrencia_origem is
  'Demanda que gerou esta ocorrencia. Identifica a serie.';
