-- Arquivar cliente — projeto que não vai acontecer.
--
-- Karine (28/09): "essa cliente desistiu do projeto — poder colocar como
-- arquivado".
--
-- Por que NÃO é um status novo: `clients.status` são os mesmos 14 valores
-- do ClickUp, e a lista do app acabou de ser alinhada à de lá (28/09). Um
-- 15º status que não existe no ClickUp quebraria essa paridade no próximo
-- sync — o `sincronizarStatusDosProjetos` sobrescreveria com o valor de lá.
--
-- Por que NÃO é "concluído": desistência não é entrega. Usar um dos dois
-- status terminais tiraria o projeto da lista, mas ele entraria na conta
-- de entregues e estragaria a taxa de conversão dos relatórios
-- (src/app/admin/relatorios/page.tsx calcula entregues/total).
--
-- Então é uma data ORTOGONAL ao status, como `arquivado` já é em
-- ei_documents: o projeto some das listas de trabalho e guarda o status
-- real de onde parou. Nulo = ativo; data = quando foi arquivado.

alter table public.clients
  add column if not exists arquivado_em timestamptz,
  -- Por que foi arquivado, em uma linha ("desistiu", "sumiu", "virou
  -- outro projeto"). Sem isso, daqui a seis meses ninguém lembra.
  add column if not exists arquivado_motivo text;

comment on column public.clients.arquivado_em is
  'Quando o projeto foi arquivado (desistência, abandono). Nulo = ativo. Ortogonal a status: NÃO conta como entrega nos relatórios.';

create index if not exists clients_arquivado_idx
  on public.clients (arquivado_em)
  where arquivado_em is null;
