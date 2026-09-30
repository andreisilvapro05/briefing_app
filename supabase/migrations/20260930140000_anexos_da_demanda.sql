-- Anexos da demanda: arquivo solto ou link de arquivos.
--
-- Karine (2026-09-30): "na parte de demandas ter uma parte para anexar o
-- arquivo ou link de arquivos".
--
-- Duas formas na mesma lista porque a agência trabalha das duas:
--  - LINK  — a pasta do Drive, o doc do ClickUp. É o caso comum, e não tem
--            teto de tamanho.
--  - ARQUIVO — o print, o PDF que chegou no WhatsApp. Sobe pro bucket
--            privado `anexos-demandas` e é servido por rota autenticada;
--            trabalho interno não pode ficar em URL pública adivinhável.
--
-- jsonb em vez de tabela nova: anexo não tem vida própria fora da demanda,
-- sempre é lido junto com ela e some junto com ela. Mesma escolha do
-- `historico` de cobrancas_mensais.

alter table public.project_tasks
  add column if not exists anexos jsonb not null default '[]'::jsonb;

comment on column public.project_tasks.anexos is
  'Lista de {id, tipo: link|arquivo, url|path, nome, mime, criado_em, criado_por}. Ver src/lib/anexos-demanda.ts.';

-- Bucket privado dos anexos de demanda. 4 MB é o teto real: a Vercel corta
-- o corpo de uma Server Action em ~4,5 MB, então prometer mais seria
-- mentira — arquivo maior vai como link.
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos-demandas', 'anexos-demandas', false, 4194304)
on conflict (id) do nothing;
