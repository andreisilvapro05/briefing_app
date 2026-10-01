-- A copy mora no app, e o cliente aprova por lá.
--
-- Karine (26/09), item 5 da descrição do processo: "preciso ter local para
-- criar a copy e anexar no app, acho que no briefing, por enquanto — e
-- precisa ter no app para mandar para o cliente aprovar também".
--
-- Até aqui a copy era um campo de LINK (`clients.copy_review_link`) que
-- apontava pro Drive: escrever, revisar e aprovar aconteciam fora, e o app
-- não sabia em que pé estava.
--
-- Reusa `ei_documents` em vez de tabela nova: é o mesmo documento de blocos
-- que a EI e o Briefing já usam, com o mesmo editor, o mesmo link público
-- por token (revogável, separado do magic_slug) e o mesmo histórico.

alter table public.ei_documents
  drop constraint if exists ei_documents_kind_check;

alter table public.ei_documents
  add constraint ei_documents_kind_check
  check (kind = any (array['ei', 'briefing', 'nota', 'copy']));

-- A resposta do cliente. Três colunas em vez de um status só: o que
-- importa é QUANDO cada coisa aconteceu, e um pedido de ajuste não apaga
-- o histórico de uma aprovação anterior a uma nova rodada.
alter table public.ei_documents
  add column if not exists aprovado_em timestamptz,
  add column if not exists ajuste_pedido_em timestamptz,
  add column if not exists aprovacao_comentario text;

comment on column public.ei_documents.aprovado_em is
  'Quando o cliente aprovou a copy pelo link público. Null = ainda não.';
comment on column public.ei_documents.ajuste_pedido_em is
  'Quando o cliente pediu ajuste. Mais recente que aprovado_em = voltou pra revisão.';
comment on column public.ei_documents.aprovacao_comentario is
  'O que o cliente escreveu ao aprovar ou pedir ajuste.';

-- Uma copy por cliente, como a EI. Parcial porque briefing e nota podem
-- se repetir, e documento avulso (client_id nulo) não tem o que duplicar.
create unique index if not exists ei_documents_client_copy_unique
  on public.ei_documents (client_id)
  where kind = 'copy' and client_id is not null;
