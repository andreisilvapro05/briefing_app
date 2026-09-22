-- Ficha de implementação: o que o desenvolvedor precisa pra montar a página.
--
-- Pedido da Karine (2026-09-22): "Daniel precisará de um usuário só com dados
-- de acesso e figma na tarefa dele, e links de botão, pixel, se tiver".
--
-- Levantamento antes de criar coluna nenhuma: o Modelo de Estrutura Inicial
-- (ei_documents id 014c3681-b69f-423c-bf64-4eb70e8cccc4) JÁ prevê três desses
-- quatro itens — mas como TÍTULO EM TEXTO CORRIDO dentro do BlockNote:
--
--   • "Dados de acesso domínio/hospedagem/wordpress:"  (parágrafo em negrito)
--   • "Link dos botões da página:"                     (heading nível 4)
--   • "Link do Figma do projeto:"                      (heading nível 4)
--
-- "Pixel" não existe em lugar nenhum do app: nem no Modelo, nem em coluna,
-- nem em migration. A única ocorrência da palavra no repositório é a
-- atividade "Integração de pixel" na timeline de project-types.ts.
--
-- Título em texto corrido não dá pra consultar: pra mostrar SÓ o Figma a
-- quem só pode ver o Figma, é preciso um campo. Varrer os blocos por regex
-- atrás do heading certo entregaria o documento inteiro a quem não pode
-- vê-lo inteiro (a EI tem copy, briefing e referências no mesmo corpo).
--
-- Os acessos já têm lugar próprio desde 20260921091934: a coluna
-- `credenciais`, que a importação usa pra tirar senha do corpo. Ela continua
-- sendo o lugar — o que muda é que agora a equipe também escreve nela pela
-- tela, em vez de só a importação.
alter table ei_documents
  -- Link do design a implementar. Um por documento: a EI já é por página
  -- (várias por cliente desde 20260922120000), então não precisa de lista.
  add column if not exists figma_url text,
  -- Pra onde cada botão da página aponta: [{ "rotulo": "...", "destino": "..." }].
  -- Lista porque uma landing tem de 3 a 10 botões e cada um vai pra um lugar
  -- (WhatsApp, formulário, âncora, checkout).
  add column if not exists botoes jsonb not null default '[]'::jsonb,
  -- Rastreamento a instalar: [{ "tipo": "...", "identificador": "...", "observacao": "..." }].
  -- "se tiver" no pedido — a maioria das páginas não tem, por isso [] e não null.
  add column if not exists pixels jsonb not null default '[]'::jsonb;

comment on column ei_documents.figma_url is
  'Link do Figma do projeto — o design que o desenvolvedor implementa. Antes era um heading em texto corrido no corpo do documento.';
comment on column ei_documents.botoes is
  'Links de botao da pagina: [{rotulo, destino}]. Antes era um heading em texto corrido no corpo do documento.';
comment on column ei_documents.pixels is
  'Pixels/tags de rastreamento a instalar: [{tipo, identificador, observacao}]. Nao existia em lugar nenhum antes.';
comment on column ei_documents.credenciais is
  'Acessos do cliente (dominio/hospedagem/WordPress): [{contexto, rotulo, valor}]. Fora do corpo do documento de proposito — nunca vai pro link publico, e so quem trabalha no projeto ve.';
