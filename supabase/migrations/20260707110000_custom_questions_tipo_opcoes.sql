-- Perguntas específicas: tipo de campo + opções (pra múltipla escolha).
--
-- tipo: "texto-curto" | "texto-longo" | "escolha" (default texto-longo).
-- opcoes: lista de alternativas quando tipo = "escolha".
--
-- Idempotente: seguro rodar mesmo se a tabela já existir sem estas colunas.

alter table public.client_custom_questions
  add column if not exists tipo text not null default 'texto-longo',
  add column if not exists opcoes jsonb not null default '[]'::jsonb;
