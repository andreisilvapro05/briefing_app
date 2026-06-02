-- ============================================================
-- Notificações pro admin — eventos que merecem destaque na UI.
--
-- Tipos: 'contrato.preenchido' | 'briefing.concluido' | 'pagamento.recebido'
-- read_at: null = não lida; preenchido = admin marcou como lida.
-- ============================================================

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  kind text not null check (kind in (
    'contrato.preenchido',
    'briefing.concluido',
    'pagamento.recebido',
    'outro'
  )),
  title text not null,
  message text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (created_at desc)
  where read_at is null;

create index if not exists admin_notifications_client_idx
  on public.admin_notifications (client_id, created_at desc);

comment on table public.admin_notifications is
  'Avisos pro admin (contrato preenchido, briefing concluído, etc). Alimentado pelas server actions/APIs e exibido no /admin.';
