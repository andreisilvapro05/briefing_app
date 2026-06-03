-- ============================================================
-- Documento de Entrega — etapa final do projeto.
--
-- entrega_documento:    JSON com acessos, tutoriais, backups, doc, garantia
-- entrega_finalizada_at: timestamp de quando admin marcou "entregue ao cliente"
-- ============================================================

alter table public.clients
  add column if not exists entrega_documento jsonb,
  add column if not exists entrega_finalizada_at timestamptz;

comment on column public.clients.entrega_documento is
  'Documento de entrega do projeto: acessos (WP, hospedagem, domínio), tutoriais, backups, documentação e garantia. Visível pro cliente no painel quando preenchido.';
comment on column public.clients.entrega_finalizada_at is
  'Quando o admin marcou a entrega como finalizada. Dispara visualização do documento no painel do cliente.';
