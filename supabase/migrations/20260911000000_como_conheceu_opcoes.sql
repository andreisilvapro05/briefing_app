-- Origem do cliente: usar `como_conheceu`, que JÁ existia.
--
-- Em 2026-09-11 cheguei a criar uma coluna `origem` sem perceber que
-- `clients.como_conheceu` já existia, já era obrigatória no formulário de
-- dados do contrato e já alimentava o relatório de origem em
-- /admin/relatorios. Duas colunas para o mesmo dado só geraria divergência,
-- então a nova foi removida.
drop index if exists clients_origem_idx;
alter table public.clients drop column if exists origem;

-- Alinha o único registro antigo com o rótulo novo da lista.
update public.clients
set como_conheceu = 'Google'
where como_conheceu = 'Google / Pesquisa';

comment on column public.clients.como_conheceu is
  'De onde o cliente veio. Preenchido pelo proprio cliente na etapa de dados do contrato (obrigatorio). Guarda o ROTULO exato da opcao escolhida — e o que o relatorio de origem agrupa.';
