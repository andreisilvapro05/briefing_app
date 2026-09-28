-- Nome que aparece nas listas, editável e à prova de sync.
--
-- Karine (28/09): "poder ir para o cliente, alterar nome".
--
-- O problema que isto resolve é meu: em 28/09 eu fiz as listas mostrarem
-- `clickup_nome` na frente, porque ela pediu "use o nome do ClickUp por
-- enquanto". Com isso, editar `empresa` na ficha deixou de ter efeito
-- visível — e pior: se eu fizesse a edição escrever em `clickup_nome`, o
-- próximo sync sobrescreveria em silêncio, que é a mesma classe de bug do
-- briefing sendo apagado pela reimportação.
--
-- Então há um terceiro campo, e só ele é manual:
--   nome_exibicao  — escrito SÓ por gente, nunca pelo sync
--   clickup_nome   — escrito só pelo sync
--   empresa/nome   — o cadastro real do cliente
--
-- Precedência na tela: nome_exibicao > clickup_nome > empresa > nome.
-- Assim o nome do ClickUp continua valendo por padrão, como ela pediu, e
-- qualquer correção feita à mão ganha de tudo e sobrevive ao sync.

alter table public.clients
  add column if not exists nome_exibicao text;

comment on column public.clients.nome_exibicao is
  'Nome que aparece nas listas, escrito à mão. Vence clickup_nome e empresa. O sync NUNCA escreve aqui.';
