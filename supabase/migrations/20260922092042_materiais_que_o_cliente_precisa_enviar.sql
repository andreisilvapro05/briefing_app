-- O que o CLIENTE precisa nos enviar — a lista que hoje vive no WhatsApp.
--
-- Pedido da Karine (2026-09-22): "ter a parte do que o cliente precisa enviar
-- no briefing". Depois que o briefing é preenchido sempre sobra o material
-- que só o cliente pode fornecer (logo em vetor, fotos, textos, depoimentos,
-- acesso ao domínio, acesso à hospedagem, CNPJ pro rodapé, links das redes).
-- Isso é combinado por mensagem, some na conversa, e a equipe descobre que
-- falta quando o projeto já parou.
--
-- Por que tabela própria e não bloco do documento de briefing: bloco é texto
-- livre — não dá pra contar "faltam 3 de 8", nem pro cliente marcar o que já
-- mandou, nem pra equipe confirmar recebimento. `briefing_files` também não
-- serve: ela registra o que CHEGOU, e o problema é justamente o que NÃO
-- chegou (e o que chega por fora do app, no WhatsApp ou no Drive).
create table if not exists public.client_materials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  titulo text not null,
  -- Instrução pro cliente: o que é, em que formato, pra onde mandar.
  instrucao text,
  ordem integer not null default 0,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'nao_se_aplica')),
  -- Quem mexeu no status por último: 'cliente' (marcou pelo link público do
  -- briefing) ou o nome de quem da equipe marcou.
  marcado_por text,
  marcado_em timestamptz,
  -- "Mandei no WhatsApp da Karine", link de uma pasta do Drive, etc.
  recado_do_cliente text,
  -- Conferência da equipe: o cliente DIZER que enviou não é o mesmo que ter
  -- chegado. Enquanto conferido_em for nulo, o item aparece como "a conferir".
  conferido_em timestamptz,
  conferido_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A lista é sempre lida inteira por cliente, na ordem que a equipe definiu.
create index if not exists client_materials_client_ordem_idx
  on public.client_materials (client_id, ordem, created_at);

drop trigger if exists client_materials_touch_updated_at on public.client_materials;
create trigger client_materials_touch_updated_at
  before update on public.client_materials
  for each row execute function public.touch_updated_at();

-- Mesmo padrão de payment_receipts/process_docs: RLS ligado e nenhuma policy.
-- O anon não lê nada; o acesso é sempre pelo servidor (service-role), que é
-- quem valida a sessão da equipe ou o token do link público do briefing.
alter table public.client_materials enable row level security;

comment on table public.client_materials is
  'O que o cliente precisa enviar pra agência (logo, fotos, textos, acessos, CNPJ). Editável e ordenável pela equipe; o cliente marca o que já mandou pelo link público do briefing e a equipe confirma o recebimento.';
comment on column public.client_materials.conferido_em is
  'Quando a equipe confirmou que o material CHEGOU. Nulo com status=enviado significa "o cliente disse que mandou, ninguém conferiu ainda".';
