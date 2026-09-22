-- Iniciativas de melhoria — o mapa de ONDE INVESTIR ESFORÇO (/admin/prioridades).
--
-- Pedido da Karine (2026-09-22): "ter uma parte de visualização também de
-- ordem de importância de execução (...) tanto para eu e a Tainá (comercial,
-- atendimento e marketing) como também para o Andrei na parte de processos e
-- gestão. Claro que precisaríamos elencar o que é mais relevante."
--
-- Por que tabela nova e não `project_tasks`: a entidade aqui NÃO é tarefa. É
-- a melhoria que a agência pode fazer pra ganhar dia de projeto ou fechar
-- mais contrato ("onboarding", "encurtar o prazo do design"). Ela não
-- pertence a cliente nenhum, não tem prazo nem status de produção, e o que
-- importa dela são dois números que tarefa não tem: impacto e esforço. Ela
-- vive enquanto a agência existir; tarefa nasce e morre no projeto.
create table if not exists public.improvement_initiatives (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  -- O que é e por que importa, em texto curto.
  detalhe text,
  -- Frente da operação. Lista PRÓPRIA desta tela — de propósito não reusa
  -- `AREAS` de lib/project-tasks.ts (que é a gaveta das demandas internas):
  -- lá o recorte é "de quem é a demanda", aqui é "qual parte do negócio
  -- melhora". Separa as audiências que a Karine citou.
  frente text not null default 'producao'
    check (frente in ('producao', 'comercial', 'atendimento', 'marketing', 'processos')),
  -- Os dois eixos do gráfico de dispersão. 0–10 nos dois, corte em 5.
  impacto smallint not null default 5 check (impacto between 0 and 10),
  esforco smallint not null default 5 check (esforco between 0 and 10),
  -- O ganho concreto, em uma linha: "-3 dias no projeto", "mais projetos
  -- fechados/mês". Opcional — nem toda iniciativa tem número.
  ganho text,
  -- Mesmos valores de TEAM_MEMBERS (project-tasks.ts): taina, valeria,
  -- karine, andrei. Texto livre no banco pelo mesmo motivo de
  -- project_tasks.responsavel: a lista da equipe vive em código.
  responsavel text,
  status text not null default 'ideia'
    check (status in ('ideia', 'fazendo', 'feito')),
  -- Ordenação manual DENTRO do grupo em que a iniciativa cai na tela
  -- (quadrante, ou "feito"). Quem troca é moverIniciativaAction.
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A lista é sempre lida inteira, na ordem que a equipe definiu.
create index if not exists improvement_initiatives_ordem_idx
  on public.improvement_initiatives (ordem, created_at);

drop trigger if exists improvement_initiatives_touch_updated_at on public.improvement_initiatives;
create trigger improvement_initiatives_touch_updated_at
  before update on public.improvement_initiatives
  for each row execute function public.touch_updated_at();

-- Mesmo padrão de client_materials/process_docs: RLS ligado e NENHUMA policy.
-- O anon não lê nada; o acesso é sempre pelo servidor (service-role), que é
-- quem valida a sessão da equipe.
alter table public.improvement_initiatives enable row level security;

comment on table public.improvement_initiatives is
  'Iniciativas de melhoria da agência — o que dá pra fazer pra ganhar tempo ou dinheiro. Plotadas em impacto x esforço em /admin/prioridades. Não é tarefa de projeto.';
comment on column public.improvement_initiatives.impacto is
  'Quanto muda a operação, 0–10. Acima de 5 é "alto impacto" (metade de cima do gráfico).';
comment on column public.improvement_initiatives.esforco is
  'Quanto custa construir, 0–10. Acima de 5 é "alto esforço" (metade da direita do gráfico).';
comment on column public.improvement_initiatives.ordem is
  'Ordem manual dentro do grupo da tela (quadrante ou "feito"). Não é prioridade global.';

-- ---------------------------------------------------------------------------
-- Semente: as iniciativas que a Karine descreveu, traduzidas em itens.
--
-- Os números de impacto/esforço são ESTIMATIVA INICIAL, pra ela corrigir na
-- tela — a interface diz isso em cima do gráfico. O que veio do julgamento
-- explícito dela: onboarding é o item 1 e copy o item 2 ("mais ganho e
-- otimização de dias do projeto"); conteúdo é "o mais importante" do
-- marketing; processo comercial é "muito importante". O resto (esforço de
-- cada uma, frente e a ordem entre as duas listas) é arbitragem nossa.
--
-- `responsavel` fica nulo de propósito: ela não atribuiu dono a nenhuma. Os
-- três nomes do design (Andrei, Karine, Valéria) são quem EXECUTA design
-- hoje, não quem responde pela melhoria — estão no detalhe, não no campo.
--
-- Guarda `where not exists`: rodar a migration de novo não duplica a lista.
insert into public.improvement_initiatives
  (titulo, detalhe, frente, impacto, esforco, ganho, ordem)
select v.titulo, v.detalhe, v.frente, v.impacto, v.esforco, v.ganho, v.ordem
from (values
  (
    'Onboarding: cliente envia as informações sem a gente cobrar',
    'Contrato, assinatura, pagamento, envio das informações pelo cliente e briefing em chamada numa sequência só, com quem faz o quê definido. Item 1 da lista da Karine: é onde o projeto mais fica parado esperando.',
    'atendimento', 10, 4, 'menos dias parados no começo de cada projeto', 1
  ),
  (
    'Copy: encurtar o tempo de redação do projeto',
    'Item 2 da lista da Karine, com o mesmo alvo do onboarding: mais ganho e otimização de dias do projeto.',
    'producao', 9, 6, 'menos dias entre o briefing e a página pronta', 2
  ),
  (
    'Design: encurtar o prazo de 12 dias úteis',
    'Já são três pessoas criando design (Andrei, Karine e Valéria) e a Karine avalia que dá pra performar melhor. O prazo hoje é 12 dias úteis; encurtar abre espaço na agenda pra fechar mais projetos.',
    'producao', 8, 7, 'mais espaço na agenda, mais projetos fechados', 3
  ),
  (
    'Postagem de conteúdo e criação de audiência',
    'Nas palavras da Karine, o mais importante do marketing.',
    'marketing', 9, 7, 'audiência própria crescendo', 4
  ),
  (
    'Criação e teste de novos anúncios',
    'Criar e testar anúncios novos com regularidade. A Karine citou junto com o conteúdo, sem marcar como o mais importante.',
    'marketing', 6, 4, null, 5
  ),
  (
    'Atendimento rápido e assertivo — melhorias no processo comercial',
    'Nas palavras da Karine, muito importante: responder rápido e com a resposta certa, e arrumar o processo comercial em volta disso.',
    'comercial', 8, 3, 'mais conversão do que já chega', 6
  )
) as v(titulo, detalhe, frente, impacto, esforco, ganho, ordem)
where not exists (select 1 from public.improvement_initiatives);
