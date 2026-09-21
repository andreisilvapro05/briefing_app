-- Aviso de material novo enviado pelo cliente.
--
-- Hoje o cliente sobe logo, fotos e documentos pelo painel e NINGUÉM fica
-- sabendo: o único sinal é `clients.last_client_activity_at`, que só aparece
-- como um ponto de "parado/ativo" na lista. O material chega e fica parado
-- até alguém abrir a ficha por outro motivo.
alter table public.admin_notifications
  drop constraint if exists admin_notifications_kind_check;
alter table public.admin_notifications
  add constraint admin_notifications_kind_check
  check (kind in (
    'contrato.preenchido',
    'briefing.concluido',
    'pagamento.recebido',
    'projeto.novo',
    'material.enviado',
    'outro'
  ));

-- Suporta a janela anti-repetição de createAdminNotification: um cliente que
-- sobe 8 arquivos seguidos gera UM aviso, não oito.
create index if not exists admin_notifications_kind_recente_idx
  on public.admin_notifications (client_id, kind, created_at desc);
