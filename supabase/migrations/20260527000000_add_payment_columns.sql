-- ============================================================
-- Acompanhamento de pagamento do projeto.
--
-- pagamento_total:        valor total do contrato (numeric)
-- pagamento_pago:         valor já recebido (numeric, default 0)
-- pagamento_observacao:   texto livre que o admin usa pra registrar
--                         parcelas, datas de recebimento, etc.
-- pagamento_atualizado_at: timestamp de última atualização (pra exibir
--                         "atualizado em X" no painel).
-- ============================================================

alter table public.clients
  add column if not exists pagamento_total numeric(10, 2),
  add column if not exists pagamento_pago numeric(10, 2) default 0,
  add column if not exists pagamento_observacao text,
  add column if not exists pagamento_atualizado_at timestamptz;

comment on column public.clients.pagamento_total is
  'Valor total do contrato (em reais). Admin preenche manualmente.';
comment on column public.clients.pagamento_pago is
  'Valor já recebido (em reais). Admin atualiza conforme entram pagamentos.';
comment on column public.clients.pagamento_observacao is
  'Notas livres do admin sobre o pagamento (parcelas, datas).';
comment on column public.clients.pagamento_atualizado_at is
  'Timestamp da última edição dos campos de pagamento.';
