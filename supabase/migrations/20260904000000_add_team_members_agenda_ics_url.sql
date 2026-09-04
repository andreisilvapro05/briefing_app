-- Endereço secreto iCal do Google Agenda por pessoa.
--
-- Antes, a agenda do dia (DayHero em /admin/meu-trabalho) só existia no
-- localStorage do navegador — quem abrisse o painel no celular não via nada.
-- Guardar na conta faz a agenda seguir a pessoa em qualquer aparelho.
--
-- CREDENCIAL: quem tem essa URL lê a agenda inteira da pessoa. Só o servidor
-- (service role) lê esta coluna; ela nunca é serializada pro navegador.
alter table public.team_members
  add column if not exists agenda_ics_url text;

comment on column public.team_members.agenda_ics_url is
  'Endereco secreto iCal do Google Agenda da pessoa. CREDENCIAL: da acesso de leitura a agenda inteira. Lido apenas pelo servidor (service role) para montar a agenda do dia; nunca exposto a outros membros nem enviado ao navegador.';
