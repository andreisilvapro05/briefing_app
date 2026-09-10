-- Custos da empresa (o que SAI), pedido da Karine em 2026-09-10.
--
-- Regra central, dita por ela: "só custos, nada de margem de lucro". Não
-- entra receita aqui — a ideia é fechar o mês sabendo quanto a empresa
-- gastou, sem misturar com o que entrou. Exemplos que ela deu: salários
-- (Valéria, Andrei, Karine), Adobe, anúncios, gestor de tráfego, uma caneta,
-- um mouse de R$47, assinatura nova de R$297.
--
-- O `recorrente` existe por um motivo específico: ferramenta sobe de preço
-- em silêncio. "Hoje você paga R$500 na Claude; nada impede que no mês 11
-- seja R$587 — e esse R$87 passa despercebido." Com o histórico por
-- competência dá pra comparar o mesmo item mês a mês e mostrar o reajuste.
create table if not exists public.company_costs (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null default 'ferramentas',
  valor numeric(12,2) not null check (valor > 0),
  -- Mês de competência, formato YYYY-MM.
  competencia text not null,
  recorrente boolean not null default false,
  fornecedor text,
  observacao text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_costs_competencia_idx
  on public.company_costs(competencia);

-- Busca por descrição normalizada: é como o mesmo custo é reconhecido entre
-- meses pra detectar reajuste.
create index if not exists company_costs_descricao_idx
  on public.company_costs(lower(descricao));

-- Mesmo padrão das outras tabelas do admin: RLS ligado, nenhuma policy —
-- só o service-role (servidor) lê e escreve.
alter table public.company_costs enable row level security;

comment on table public.company_costs is
  'Custos que SAEM da empresa (salarios, ferramentas, anuncios, equipamento). So despesa — nada de receita ou margem, de proposito: serve pra fechar quanto a empresa gastou no mes. `competencia` e o mes no formato YYYY-MM.';

comment on column public.company_costs.recorrente is
  'Custo que se repete todo mes (assinatura, salario). E o que permite detectar reajuste silencioso: mesma descricao, valor maior que o mes anterior.';
