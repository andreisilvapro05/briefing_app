-- ============================================================
-- Integração com Autentique — colunas pra rastrear o contrato assinado.
--
-- autentique_document_id: id retornado pelo Autentique ao criar o doc.
-- contrato_status:        'pendente' | 'assinado' | 'rejeitado' | 'cancelado'.
-- contrato_signed_url:    URL do PDF assinado (depois que cliente assinar).
-- contrato_dados:         JSON com os dados que o admin preencheu pra gerar
--                         (pacote_nome, valor_parcelamento, prazo_execucao etc.) —
--                         útil pra reenviar/regerar sem precisar redigitar.
-- ============================================================

alter table public.clients
  add column if not exists autentique_document_id text,
  add column if not exists contrato_status text
    check (
      contrato_status is null
      or contrato_status in ('pendente', 'assinado', 'rejeitado', 'cancelado')
    ),
  add column if not exists contrato_signed_url text,
  add column if not exists contrato_dados jsonb;

create index if not exists clients_contrato_status_idx
  on public.clients(contrato_status);

comment on column public.clients.autentique_document_id is
  'ID do documento criado no Autentique. Null = ainda não enviado.';
comment on column public.clients.contrato_status is
  'Status do contrato no Autentique. Atualizado por refresh manual ou webhook.';
comment on column public.clients.contrato_signed_url is
  'URL pública do PDF assinado (vem do Autentique).';
comment on column public.clients.contrato_dados is
  'Dados que o admin preencheu pra gerar o contrato (pacote, valor, etc.).';

-- ============================================================
-- Storage: bucket privado pros modelos de contrato (.docx).
-- Apenas o backend (service role) lê/escreve.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('contracts-templates', 'contracts-templates', false)
on conflict (id) do nothing;
