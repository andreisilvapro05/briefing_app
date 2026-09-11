-- De onde o cliente veio (atribuição do lead).
--
-- Pedido da Karine em 2026-09-11: "quero ver de forma fácil de onde o
-- cliente veio". Não existia nada disso no app — o dado só vivia no CRM
-- externo, e o briefing nunca perguntou. Agora é PERGUNTA OBRIGATÓRIA na
-- primeira tela do cliente (nome + WhatsApp + como conheceu).
--
-- Texto livre na coluna, mas a UI oferece opções fixas: sem padronizar não
-- dá pra somar quantos vieram de cada canal depois.
alter table public.clients
  add column if not exists origem text;

create index if not exists clients_origem_idx on public.clients(origem);

comment on column public.clients.origem is
  'De onde o cliente veio (instagram, indicacao, tiktok, curso...). Preenchido pelo proprio cliente na primeira tela; o time pode corrigir na ficha. Vale a PRIMEIRA resposta — cliente que volta nao sobrescreve a atribuicao original.';
