-- ============================================================
-- Cliente identificação inicial agora pede só nome + WhatsApp.
-- Email e empresa migram pra etapa /contrato (faz mais sentido lá).
-- Tornamos as colunas nullable pra suportar clientes que ainda não preencheram.
-- ============================================================

alter table public.clients alter column email drop not null;
alter table public.clients alter column empresa drop not null;

comment on column public.clients.email is
  'Coletado em /contrato (não mais em / Tela 1). Pode ser null até cliente preencher.';
comment on column public.clients.empresa is
  'Coletado em /contrato (não mais em / Tela 1). Pode ser null até cliente preencher.';
