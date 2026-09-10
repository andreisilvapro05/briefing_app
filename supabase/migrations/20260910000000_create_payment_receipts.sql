-- Comprovantes de pagamento por cliente.
--
-- Problema real (Karine, 2026-09-10): muitos clientes não pagam pelo link do
-- Autentique — pagam direto no Pix e mandam o print no grupo do WhatsApp. O
-- comprovante se perde na conversa e o sistema fica desatualizado: duas
-- semanas depois ninguém sabe se aquele cliente pagou, e alguém tem que
-- caçar a conversa pra descobrir.
--
-- Cada linha aqui é um pagamento RECEBIDO, com a prova anexada.
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  pago_em date not null,
  forma text not null default 'pix',
  -- Caminho no bucket PRIVADO 'comprovantes' (nunca URL pública: é documento
  -- financeiro, servido por rota autenticada).
  arquivo_path text,
  arquivo_nome text,
  arquivo_tipo text,
  observacao text,
  -- Quem registrou — a ideia é a Tainá fazer isso, então importa saber.
  registrado_por text,
  created_at timestamptz not null default now()
);

create index if not exists payment_receipts_client_idx
  on public.payment_receipts(client_id, pago_em desc);

-- Mesmo padrão de process_docs: RLS ligado e nenhuma policy — só o
-- service-role (servidor) lê e escreve.
alter table public.payment_receipts enable row level security;

comment on table public.payment_receipts is
  'Pagamentos recebidos com comprovante anexado. Substitui o print perdido no WhatsApp: prova de que o cliente pagou, ligada ao valor e à data.';

-- Bucket privado dos comprovantes (aplicado via SQL no mesmo dia):
-- insert into storage.buckets (id, name, public, file_size_limit)
-- values ('comprovantes', 'comprovantes', false, 10485760);
