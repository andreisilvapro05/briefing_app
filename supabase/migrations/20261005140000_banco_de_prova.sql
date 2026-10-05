-- Banco de prova — cada projeto entregue vira prova organizada e AUTORIZADA.
--
-- PRD de 05/10 ("Banco de prova, Fábrica de conteúdo e Base de dúvidas"),
-- módulo 1: "cada projeto entregue vira prova organizada e autorizada
-- (antes e depois, depoimento, resultado com fonte), pronta para conteúdo,
-- proposta e lançamento, sem depender da memória da Karine".
--
-- ESTA VERSÃO NÃO TEM CAPTURA AUTOMÁTICA DE PRINT. O PRD lista "serviço de
-- captura (API externa paga ou Playwright numa função ou na VPS)" como
-- pendência a decidir. O antes e o depois entram por upload manual; quando
-- a captura for decidida, ela só passa a CRIAR os mesmos `proof_assets`,
-- com `origem = 'automatico'` — nada aqui muda.

create table if not exists public.proof_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'a_coletar'
    check (status in ('a_coletar','coletado','conferido','aprovado_para_uso','usado','sem_autorizacao','arquivado')),

  -- Pra filtrar "provas aprovadas, nível 3, segmento saúde" numa tela.
  segmento text,
  servico text,
  cidade text,
  site_url text,

  depoimento_texto text,
  depoimento_audio_path text,
  depoimento_transcricao text,
  nota smallint check (nota is null or (nota >= 0 and nota <= 10)),

  -- NÍVEL DE AUTORIZAÇÃO. 1 = só proposta interna; 2 = pode mostrar o site
  -- e o nome da empresa; 3 = nome, foto, depoimento e marca em conteúdo
  -- público e anúncio. Nada sai como público sem nível registrado.
  autorizacao_nivel smallint
    check (autorizacao_nivel is null or autorizacao_nivel in (1,2,3)),
  autorizacao_termo text,
  autorizado_por text,
  autorizado_em timestamptz,

  resultado_texto text,
  resultado_fonte text,
  resultado_data date,

  tags text[] not null default '{}',
  -- [{tipo: post|proposta|pagina|anuncio, link, data}]
  usado_em jsonb not null default '[]'::jsonb,

  conferido_por text,
  conferido_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- REGRA DO PRD, no banco: "Resultado só com fonte e data. Campo vazio é
  -- melhor que número sem origem."
  --
  -- Um número sem origem é pior que nenhum número: ele vira slide, vira
  -- anúncio, e ninguém lembra de onde saiu quando alguém pergunta. A trava
  -- mora aqui porque a tela não é o único caminho de escrita.
  constraint proof_resultado_precisa_de_fonte check (
    resultado_texto is null
    or (resultado_fonte is not null and resultado_data is not null)
  ),

  -- Autorizar é um ato: quem e quando ficam registrados junto do nível.
  constraint proof_autorizacao_registrada check (
    autorizacao_nivel is null
    or (autorizado_por is not null and autorizado_em is not null)
  )
);

create index if not exists proof_items_client_idx on public.proof_items (client_id);
create index if not exists proof_items_status_idx on public.proof_items (status);

create table if not exists public.proof_assets (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proof_items(id) on delete cascade,
  tipo text not null check (tipo in ('antes','depois','print','logo','foto','video')),
  dispositivo text check (dispositivo is null or dispositivo in ('desktop','celular')),
  capturado_em date,
  storage_path text not null,
  legenda text,
  -- 'upload' hoje; 'automatico' quando a captura de print existir.
  origem text not null default 'upload' check (origem in ('upload','automatico')),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists proof_assets_por_prova_idx
  on public.proof_assets (proof_id, tipo, ordem);

-- RLS deny-all, como o resto do app: quem autoriza é o código, com
-- service-role. O depoimento do cliente chega por Server Action, não por
-- cliente anônimo escrevendo direto na tabela.
alter table public.proof_items enable row level security;
alter table public.proof_assets enable row level security;

comment on table public.proof_items is
  'Banco de prova: um projeto entregue como prova autorizada. O nível de autorização decide onde pode aparecer.';
comment on column public.proof_items.autorizacao_nivel is
  '1 = uso interno (proposta). 2 = pode mostrar site e nome da empresa. 3 = nome, foto, depoimento e marca em conteúdo público e anúncio.';
