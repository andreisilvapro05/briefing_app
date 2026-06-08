-- ============================================================
-- Expansão de cobrancas_mensais pra cobrir cobranças PONTUAIS também
-- (ex: licença anual, taxa de setup, projeto avulso fora do briefing_app).
--
-- tipo:              'mensal' | 'pontual' — default 'mensal' (compat)
-- data_vencimento:   pra pontuais (mensais usam dia_cobranca + mes corrente)
-- ============================================================

alter table public.cobrancas_mensais
  add column if not exists tipo text not null default 'mensal'
    check (tipo in ('mensal', 'pontual')),
  add column if not exists data_vencimento date;

create index if not exists cobrancas_mensais_tipo_idx
  on public.cobrancas_mensais (tipo, ativa);

comment on column public.cobrancas_mensais.tipo is
  'mensal = recorrente; pontual = uma vez só (usa data_vencimento).';
comment on column public.cobrancas_mensais.data_vencimento is
  'Pra cobranças pontuais. Mensais usam dia_cobranca.';
