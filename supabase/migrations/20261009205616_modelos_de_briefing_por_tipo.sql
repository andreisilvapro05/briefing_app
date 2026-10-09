-- Os três modelos de briefing eram cópias byte a byte do "Modelo geral":
-- 106 blocos, 28.586 caracteres, mesmo md5 nos quatro. Quem escolhia
-- "Briefing — Site" recebia as perguntas de uma landing page de serviço.
--
-- Esta migration diferencia os dois que precisavam disso. O "Modelo geral"
-- e o "Landing page de negócio" ficam como estão: o geral JÁ É um briefing
-- de landing de negócio (pergunta especialidade, atendimento, botão de
-- WhatsApp), então ele serve de backup se algo aqui precisar voltar atrás.
--
-- Idempotente: cada bloco novo é inserido só se o título-âncora dele ainda
-- não existir no documento.

-- Monta um bloco no formato que o BlockNote espera.
create or replace function pg_temp.bloco(tipo text, nivel int, texto text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', tipo,
    'props', case
      when tipo = 'heading' then jsonb_build_object(
        'level', nivel, 'textColor', 'default', 'isToggleable', false,
        'textAlignment', 'left', 'backgroundColor', 'default')
      when tipo = 'checkListItem' then jsonb_build_object(
        'checked', false, 'textColor', 'default',
        'textAlignment', 'left', 'backgroundColor', 'default')
      else jsonb_build_object(
        'textColor', 'default', 'textAlignment', 'left',
        'backgroundColor', 'default')
    end,
    -- Bloco vazio é content [], não um texto em branco: com texto em branco
    -- o editor mostra uma linha que não dá pra apagar.
    'content', case when texto = '' then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('text', texto, 'type', 'text', 'styles', '{}'::jsonb)) end,
    'children', '[]'::jsonb);
$$;

-- Texto corrido de um bloco, pra achar a posição pelo título e não por
-- número de linha (o documento é editável; índice fixo apodrece).
create or replace function pg_temp.texto_do(blk jsonb)
returns text language sql immutable as $$
  select coalesce(
    (select string_agg(c->>'text', '') from jsonb_array_elements(blk->'content') c),
    '');
$$;

create or replace function pg_temp.tem_titulo(doc jsonb, titulo text)
returns boolean language sql stable as $$
  select exists (
    select 1 from jsonb_array_elements(doc->'blocks') b
     where pg_temp.texto_do(b) = titulo);
$$;

/* ─────────────────────────────────────────────────────────────────────────
   Briefing — Site
   O que separa um site de uma landing é ter VÁRIAS páginas. Entra antes de
   "Informações sobre domínio e hospedagem", que é o fim do documento.
   ───────────────────────────────────────────────────────────────────────── */
do $$
declare
  alvo uuid := '831147ff-5318-40b4-b248-508fc402db95';
  doc jsonb;
  pos int;
  novos jsonb;
begin
  select ei_data into doc from ei_documents where id = alvo;
  if doc is null then
    raise notice 'Modelo de Site não encontrado (%), nada a fazer', alvo;
    return;
  end if;
  if pg_temp.tem_titulo(doc, 'As páginas do site') then
    raise notice 'Modelo de Site já diferenciado, nada a fazer';
    return;
  end if;

  select min(o) - 1 into pos
    from jsonb_array_elements(doc->'blocks') with ordinality t(e, o)
   where pg_temp.texto_do(e) = 'Informações sobre domínio e hospedagem';
  if pos is null then
    raise exception 'Âncora "Informações sobre domínio e hospedagem" não existe no modelo de Site';
  end if;

  select jsonb_agg(pg_temp.bloco(tipo, nivel, texto) order by o) into novos
    from (values
      (1,  'heading', 3, 'As páginas do site'),
      (2,  'paragraph', null, 'Um site tem mais de uma página — é isso que o separa de uma landing. Liste as páginas que você quer. Se ainda não souber, escreva o que precisa aparecer e a gente propõe a estrutura.'),
      (3,  'bulletListItem', null, 'Quais páginas o site precisa ter? (ex.: Início, Sobre, Serviços, Blog, Contato)'),
      (4,  'bulletListItem', null, 'Algum serviço merece uma página só dele? Quais?'),
      (5,  'bulletListItem', null, 'Já existe um site hoje? Qual o endereço?'),
      (6,  'bulletListItem', null, 'Do site atual, o que deve ser aproveitado — e o que não deve vir de jeito nenhum?'),
      (7,  'paragraph', null, 'O site vai ter blog?'),
      (8,  'checkListItem', null, 'Sim — e a agência cuida dos textos'),
      (9,  'checkListItem', null, 'Sim — e eu mesmo vou publicar'),
      (10, 'checkListItem', null, 'Não'),
      (11, 'paragraph', null, 'O site precisa de alguma dessas partes?'),
      (12, 'checkListItem', null, 'Não, é institucional'),
      (13, 'checkListItem', null, 'Agendamento online'),
      (14, 'checkListItem', null, 'Catálogo de produtos, sem venda pelo site'),
      (15, 'checkListItem', null, 'Loja com pagamento'),
      (16, 'checkListItem', null, 'Área de login do cliente'),
      (17, 'paragraph', null, ''),
      (18, 'heading', 3, 'Ser achado no Google'),
      (19, 'paragraph', null, 'No site vale investir nisso, porque cada página pode aparecer numa busca diferente.'),
      (20, 'bulletListItem', null, 'Em quais cidades ou regiões você quer aparecer?'),
      (21, 'bulletListItem', null, 'Qual página deveria aparecer para qual busca? (ex.: a página de X para quem procura Y)'),
      (22, 'bulletListItem', null, 'Tem Google Meu Negócio? Cole o link:'),
      (23, 'bulletListItem', null, 'Concorrentes que aparecem bem no Google:')
    ) v(o, tipo, nivel, texto);

  update ei_documents
     set ei_data = jsonb_set(doc, '{blocks}',
           coalesce((select jsonb_agg(e order by o)
                       from jsonb_array_elements(doc->'blocks') with ordinality t(e, o)
                      where o - 1 < pos), '[]'::jsonb)
           || novos
           || coalesce((select jsonb_agg(e order by o)
                          from jsonb_array_elements(doc->'blocks') with ordinality t(e, o)
                         where o - 1 >= pos), '[]'::jsonb)),
         updated_at = now()
   where id = alvo;
end $$;

/* ─────────────────────────────────────────────────────────────────────────
   Briefing — Landing page de produto digital
   Aqui "Informações sobre o seu serviço" SAI: ela pergunta especialidade e
   "como funciona o atendimento/tratamento", que não existe em infoproduto.
   No lugar entram oferta, checkout, prova e objeção. As palavras-chave, que
   moravam na seção removida, continuam no fim — o tráfego pago usa.
   ───────────────────────────────────────────────────────────────────────── */
do $$
declare
  alvo uuid := 'aadad532-f79b-4e34-ade5-71aa707af3b3';
  doc jsonb;
  ini int;
  fim int;
  novos jsonb;
begin
  select ei_data into doc from ei_documents where id = alvo;
  if doc is null then
    raise notice 'Modelo de produto digital não encontrado (%), nada a fazer', alvo;
    return;
  end if;
  if pg_temp.tem_titulo(doc, 'A oferta') then
    raise notice 'Modelo de produto digital já diferenciado, nada a fazer';
    return;
  end if;

  select min(o) - 1 into ini
    from jsonb_array_elements(doc->'blocks') with ordinality t(e, o)
   where pg_temp.texto_do(e) = 'Informações sobre o seu serviço';
  select min(o) - 1 into fim
    from jsonb_array_elements(doc->'blocks') with ordinality t(e, o)
   where pg_temp.texto_do(e) = 'Informações sobre domínio e hospedagem';
  if ini is null or fim is null or fim <= ini then
    raise exception 'Âncoras da seção de serviço não batem no modelo de produto digital (ini=%, fim=%)', ini, fim;
  end if;

  select jsonb_agg(pg_temp.bloco(tipo, nivel, texto) order by o) into novos
    from (values
      (1,  'heading', 4, 'A oferta'),
      (2,  'paragraph', null, 'Esta é a parte que mais pesa numa página de produto digital: o que a pessoa compra, por quanto, e por que agora.'),
      (3,  'bulletListItem', null, 'Qual é o nome do produto?'),
      (4,  'bulletListItem', null, 'O que exatamente a pessoa recebe quando compra? (módulos, encontros, materiais, tempo de acesso)'),
      (5,  'bulletListItem', null, 'Onde a pessoa está antes de comprar, e onde ela chega depois?'),
      (6,  'bulletListItem', null, 'Preço cheio e preço da oferta:'),
      (7,  'bulletListItem', null, 'Em quantas vezes pode parcelar?'),
      (8,  'bulletListItem', null, 'Tem bônus? Quais, e quanto valeria cada um se fosse vendido à parte:'),
      (9,  'bulletListItem', null, 'Tem garantia? De quantos dias:'),
      (10, 'paragraph', null, 'A venda fica...'),
      (11, 'checkListItem', null, 'Aberta o ano todo'),
      (12, 'checkListItem', null, 'Com data para fechar'),
      (13, 'checkListItem', null, 'Com vagas limitadas'),
      (14, 'bulletListItem', null, 'Se tem data ou vaga limitada, qual é? (é o número que vai na contagem da página)'),
      (15, 'paragraph', null, ''),
      (16, 'heading', 4, 'Checkout e entrega'),
      (17, 'bulletListItem', null, 'Em qual plataforma é o checkout? (Hotmart, Kiwify, Eduzz, Cakto, outra)'),
      (18, 'bulletListItem', null, 'Cole o link do checkout — um para cada oferta, se houver mais de uma:'),
      (19, 'bulletListItem', null, 'Onde a pessoa acessa o conteúdo depois de comprar?'),
      (20, 'bulletListItem', null, 'Tem alguma oferta extra na hora da compra? Qual:'),
      (21, 'paragraph', null, ''),
      (22, 'heading', 4, 'Provas'),
      (23, 'paragraph', null, 'Página de produto digital vive de prova. Quanto mais concreto, melhor.'),
      (24, 'bulletListItem', null, 'Depoimentos de quem já comprou — texto, print ou vídeo (anexar no drive):'),
      (25, 'bulletListItem', null, 'Resultados que alguém teve, com número e com o nome de quem foi:'),
      (26, 'bulletListItem', null, 'Quantas pessoas já passaram pelo produto?'),
      (27, 'bulletListItem', null, 'O que te dá autoridade nesse assunto? (formação, tempo de experiência, mídia, palco)'),
      (28, 'paragraph', null, ''),
      (29, 'heading', 4, 'O que trava a compra'),
      (30, 'bulletListItem', null, 'Os três motivos mais comuns de alguém olhar e não comprar:'),
      (31, 'bulletListItem', null, 'Para quem este produto NÃO serve? (dizer isso aumenta a confiança de quem serve)'),
      (32, 'bulletListItem', null, 'O que essa pessoa já tentou antes e não funcionou?'),
      (33, 'paragraph', null, ''),
      (34, 'bulletListItem', null, 'Palavras-chave principais?'),
      (35, 'bulletListItem', null, 'Palavras-chave auxiliares?')
    ) v(o, tipo, nivel, texto);

  update ei_documents
     set ei_data = jsonb_set(doc, '{blocks}',
           coalesce((select jsonb_agg(e order by o)
                       from jsonb_array_elements(doc->'blocks') with ordinality t(e, o)
                      where o - 1 < ini), '[]'::jsonb)
           || novos
           || coalesce((select jsonb_agg(e order by o)
                          from jsonb_array_elements(doc->'blocks') with ordinality t(e, o)
                         where o - 1 >= fim), '[]'::jsonb)),
         updated_at = now()
   where id = alvo;
end $$;
