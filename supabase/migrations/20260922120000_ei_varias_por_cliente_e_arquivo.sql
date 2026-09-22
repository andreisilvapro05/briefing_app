-- Estrutura Inicial: várias por cliente, e um arquivo histórico separado.
--
-- Decisão da Karine em 2026-09-22: "EI precisa puxar do ClickUp todas mesmo
-- que depois tenhamos que arquivar, precisamos deixar um banco de dados
-- salvo". São 529 páginas em quatro docs do ClickUp; ~400 com conteúdo real.
--
-- Dois bloqueios de schema saíam disso:
--
-- 1) `ei_documents_client_ei_unique` só aceitava UMA EI por cliente. A Sofia
--    Rito tem 3 só em 2026, e cliente que voltou tem uma por projeto. Com o
--    índice no lugar, a importação perderia EI ou sobrescreveria a boa.
--    O briefing já foi liberado assim na migration 20260921091934; a EI
--    seguia presa por não ter havido motivo até agora.
--
-- 2) Sem marcar o que é arquivo, a barra lateral de Estruturas Iniciais
--    viraria uma lista plana de 400 nomes com busca — pior do que é hoje
--    pra achar a EI do cliente de amanhã.
drop index if exists ei_documents_client_ei_unique;

alter table ei_documents
  -- true = material histórico, fora do fluxo do dia a dia. A tela separa
  -- "ativos" de "arquivo"; a busca alcança os dois.
  add column if not exists arquivado boolean not null default false,
  -- De qual doc do ClickUp a página veio. Serve pra reimportar um doc
  -- específico e pra saber a procedência sem abrir o documento.
  add column if not exists clickup_doc_id text,
  -- Data que aparece no título/corpo da página no ClickUp ("EI's - 2026").
  -- É o que ordena o arquivo: `updated_at` seria a data da IMPORTAÇÃO, que
  -- é igual pra todas e não diz nada.
  add column if not exists referencia_em timestamptz;

-- A lista do dia a dia lê só os ativos; o arquivo é consultado à parte.
create index if not exists ei_documents_kind_arquivado_idx
  on ei_documents (kind, arquivado, updated_at desc);

-- Várias EIs por cliente: a ficha mostra a mais recente em cima.
create index if not exists ei_documents_client_kind_ref_idx
  on ei_documents (client_id, kind, referencia_em desc nulls last)
  where client_id is not null;

comment on column ei_documents.arquivado is
  'true = Estrutura Inicial historica (ex-cliente ou versao antiga), importada do ClickUp como arquivo. Fica fora das listas do dia a dia.';
comment on column ei_documents.clickup_doc_id is
  'Doc do ClickUp de onde a pagina veio. Os quatro docs de EI: xj7td-89891 (2026), xj7td-4043, xj7td-34431, xj7td-89291.';
