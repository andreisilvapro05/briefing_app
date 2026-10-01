-- Responsável e datas do projeto editáveis na lista, sem o sync desfazer.
--
-- Karine (01/10), com as setas na linha do projeto: "precisa ser editável
-- como é no ClickUp".
--
-- A linha era só-leitura por um motivo que DEIXOU DE VALER: até 28/09 o
-- projeto não tinha responsável nem datas próprios, então editar ali
-- mudaria uma TAREFA escolhida por regra, sem a pessoa ver qual. Hoje
-- `clients.responsavel/data_inicial/data_vencimento` existem e são o que
-- a coluna mostra — editar escreve no projeto, e em mais nada.
--
-- O problema que estas colunas resolvem: `sincronizarStatusDosProjetos`
-- roda todo dia às 9h e sobrescreve esses três campos com o que está no
-- ClickUp. Sem marcar o que foi escrito à mão, a edição duraria até a
-- manhã seguinte e voltaria sozinha — que é pior do que não deixar
-- editar, porque some sem avisar.
--
-- Mesma ideia de `nome_exibicao`, que o sync nunca toca.

alter table public.clients
  add column if not exists responsavel_manual boolean not null default false,
  add column if not exists data_inicial_manual boolean not null default false,
  add column if not exists data_vencimento_manual boolean not null default false;

comment on column public.clients.responsavel_manual is
  'true = escrito à mão no app; o sync do ClickUp não sobrescreve. Ver src/lib/clickup-status-sync.ts.';
comment on column public.clients.data_inicial_manual is
  'true = escrita à mão no app; o sync do ClickUp não sobrescreve.';
comment on column public.clients.data_vencimento_manual is
  'true = escrita à mão no app; o sync do ClickUp não sobrescreve.';
