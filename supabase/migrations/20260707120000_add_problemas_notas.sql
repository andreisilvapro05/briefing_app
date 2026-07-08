-- Mapeamento de problemas: bloco de notas livre por cliente (aba "Problemas"
-- do admin). Texto simples; o admin anota bloqueios/pendências do cliente.

alter table public.clients
  add column if not exists problemas_notas text;
