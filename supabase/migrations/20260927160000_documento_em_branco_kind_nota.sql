-- Documento em branco, pra anotar qualquer coisa — uma copy nova, por exemplo.
--
-- Pedido da Karine (27/09): "quero uma parte que eu possa criar um documento
-- limpo também para anotar coisas, por exemplo para criar uma copy nova".
--
-- Reusa a mesma tabela e o mesmo editor de blocos das Estruturas Iniciais e
-- dos Documentos de Briefing. O que muda é só o `kind`: nasce vazio, sem
-- Modelo e sem cliente obrigatório.
--
-- Por que um kind novo em vez de reaproveitar 'briefing' com client_id nulo:
-- a barra lateral lista por kind, e misturar "briefing da Danielle" com
-- "copy nova" na mesma lista fica pior a cada documento criado.

alter table public.ei_documents
  drop constraint if exists ei_documents_kind_check;

alter table public.ei_documents
  add constraint ei_documents_kind_check
  check (kind in ('ei', 'briefing', 'nota'));
