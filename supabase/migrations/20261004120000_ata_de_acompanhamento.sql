-- Ata de acompanhamento — o registro que o gestor de projetos mantém.
--
-- Karine (04/10), repassando o pedido do Andrei: "ter uma parte de ata para
-- o Andrei usar, ele quer que tenha: nome cliente / status que está / campo
-- para observacao / campo para anexar algo escrito como um google docs, mas
-- melhorado / e quando ele muda o status do cliente para finalizado some
-- dali. precisa ter os documentos por datas".
--
-- POR QUE NÃO É TABELA NOVA
--
-- O "google docs melhorado" é exatamente o editor de blocos (BlockNote) que
-- a EI, o Briefing, a Nota e a Copy já usam sobre `ei_documents.ei_data`:
-- autosave debounced, "Copiar MD" e o `theme="light"` que acabou de ser
-- consertado (o briefing abria PRETO pra quem usa o sistema no escuro).
-- Uma tabela própria obrigaria a um SEGUNDO componente de editor e a uma
-- SEGUNDA action de autosave — e o próximo defeito do BlockNote teria de
-- ser caçado duas vezes. A história deste app mostra que ele aparece.
--
-- O QUE A ATA TEM DE DIFERENTE DOS OUTROS KINDS
--
--   * MUITAS por cliente, uma por data. EI e Copy têm índice único por
--     cliente; a ata não ganha nenhum — ter várias é o pedido, não um
--     acidente ("precisa ter os documentos por datas").
--   * `observacao`: a linha curta que se lê NA LISTA, sem abrir o
--     documento. É a única coluna nova desta migration.
--   * a DATA da ata reusa `referencia_em`, que já significa literalmente
--     "a data que distingue os vários documentos do mesmo cliente" (foi
--     criada em 22/09 pra separar as EIs importadas do ClickUp).
--
-- O STATUS NÃO É GRAVADO AQUI
--
-- É lido de `clients.status` na hora de montar a tela. É isso que faz
-- "quando ele muda o status para finalizado some dali" funcionar sem
-- escrita nenhuma na ata — e evita dois status divergentes para o mesmo
-- projeto, que é o defeito que uma cópia local do status teria no dia em
-- que o sync do ClickUp mexesse num e não no outro.
--
-- RLS: `ei_documents` já está com RLS habilitado e ZERO políticas
-- (deny-all) — quem autoriza é o código, com service-role, como no resto
-- do app. Nada a fazer aqui: reusar a tabela herda a mesma trava.

alter table public.ei_documents
  drop constraint if exists ei_documents_kind_check;

alter table public.ei_documents
  add constraint ei_documents_kind_check
  check (kind = any (array['ei', 'briefing', 'nota', 'copy', 'ata']));

alter table public.ei_documents
  add column if not exists observacao text;

comment on column public.ei_documents.observacao is
  'Observação curta da ata (kind = ata): o que se lê na lista sem abrir o documento.';

comment on column public.ei_documents.referencia_em is
  'A data que distingue os vários documentos do mesmo cliente. Nas EIs importadas é a data da página no ClickUp; nas atas (kind = ata) é a data da reunião. Gravada ao meio-dia UTC nas atas, pra o dia não escorregar no fuso de Brasília.';

-- A lista de atas é sempre "deste cliente, mais recente primeiro".
create index if not exists ei_documents_ata_por_data_idx
  on public.ei_documents (client_id, referencia_em desc)
  where kind = 'ata';
