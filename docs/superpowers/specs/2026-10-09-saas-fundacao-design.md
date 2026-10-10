# SaaS — Fase 1: Fundação

Desenho aprovado em conversa com a Karine em 09/10/2026. Esta fase não
vende nada e não tem tela de produto: ela existe pra que as quatro fases
seguintes não precisem ser refeitas.

## Por que este documento existe

A Karine vai criar um SaaS pra vender, adaptado dos dois sistemas que ela
já tem, **sem substituir nenhum dos dois**. O comprador escolhido é
*qualquer prestador que vende por projeto* — consultoria, arquitetura,
advocacia, dev, design.

O diferencial não é gestão de projeto, que todo concorrente tem. É
**transformar conversa em escopo fechado**: a conversa do WhatsApp chega
sozinha pela ponte que ela já construiu, e o briefing é um documento que o
cliente preenche por link. O produto de referência que ela escolheu
(gestao.dev) começa depois disso — a I.A. deles pede que você cole a
conversa.

## Decisões já tomadas (não reabrir sem motivo novo)

| Decisão | Escolha | Por quê |
|---|---|---|
| Comprador | qualquer prestador que vende por projeto | decisão da Karine, 09/10 |
| Isolamento | `org_id` em toda tabela, imposto por RLS | ver "Isolamento" |
| Organização no token | resolvida por `memberships`, sem claim | sem hook pra manter |
| Papéis na Fase 1 | `owner`, `admin`, `membro` | os 4 do briefing_app são a forma da Fysi |
| Hospedagem | **VPS própria** (Docker + EasyPanel), não Vercel | custo e os dois tetos da Vercel |
| Build | fora da VPS, em CI | `next build` estoura RAM em máquina básica |
| Repo e banco | novos, na conta dela | não encostar no que está no ar |

## Correções de rota vindas da varredura (09/10)

- **Metas** não estava em nenhuma fase. Entra na Fase 4.
- **Personalização de marca** não estava explícita. Num produto vendido a
  prestador, a proposta tem que sair com a marca *dele*. Entra na Fase 2.
- O documento completo de escopo e pré-requisitos é
  `2026-10-09-saas-pre-requisitos.md`, neste mesmo diretório.

## Não-objetivos desta fase

Nada de: cobrança de assinatura, I.A., WhatsApp, proposta, contrato,
briefing, telas de entrega, domínio por inquilino, schema por inquilino,
aplicativo. Se aparecer vontade de fazer qualquer um deles aqui, a resposta
é "Fase 2 em diante".

---

## Modelo de dados

### O inquilino

```sql
create table public.orgs (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,
  criada_em  timestamptz not null default now()
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  papel      text not null check (papel in ('owner','admin','membro')),
  criado_em  timestamptz not null default now(),
  unique (org_id, user_id)
);

-- a policy de toda tabela passa por aqui; sem este índice, cada leitura
-- varre memberships
create index memberships_user_org on public.memberships (user_id, org_id);
```

Regra: **toda** tabela de dados nasce com `org_id uuid not null references
public.orgs(id) on delete cascade`. Inclusive as de configuração. Não existe
tabela "global" fora de `plans`.

`owner` é único por organização, é quem paga, e não pode ser removido nem
rebaixado — a última linha `owner` de uma organização é protegida por
trigger, senão a conta fica sem dono e sem ninguém que possa pagar.

### Configuração por organização

É o que separa "o sistema da Fysi" de um produto. Hoje `AREAS`,
`TEAM_MEMBERS`, `DEFAULT_PROJECT_TASKS`, os 14 status e o mapa do ClickUp
são constantes em `src/lib/project-tasks.ts` do briefing_app. Aqui viram
linhas:

```sql
create table public.org_tipos_projeto (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  nome text not null, ordem int not null default 0, ativo boolean not null default true
);

create table public.org_etapas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  tipo_projeto_id uuid references public.org_tipos_projeto(id) on delete cascade,
  nome text not null, ordem int not null default 0
);

create table public.org_status (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  nome text not null, cor text, ordem int not null default 0,
  encerra boolean not null default false   -- status que tira o projeto da fila
);

create table public.org_areas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  nome text not null, ordem int not null default 0
);
```

`ordem` é `int` e **não** é única nem contígua — mesma decisão do
`project_tasks.ordem` do briefing_app, onde abrir buraco na numeração deu
errado e a solução foi renumerar a lista inteira na inserção
(`src/lib/ordem-tarefas.ts`). O mesmo utilitário vem pra cá.

### Cotas e plano — a forma, sem cobrar nada

```sql
create table public.plans (
  codigo text primary key,
  nome text not null,
  limites jsonb not null default '{}'::jsonb,  -- {"propostas": 10, "ia": 0}
  preco_centavos int not null default 0,
  ativo boolean not null default true
);

create table public.org_subscriptions (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  plano text not null references public.plans(codigo),
  periodo_inicio date not null,
  criada_em timestamptz not null default now()
);

create table public.usage_counters (
  org_id uuid not null references public.orgs(id) on delete cascade,
  metrica text not null,
  periodo date not null,          -- primeiro dia do período, em Brasília
  contagem int not null default 0,
  primary key (org_id, metrica, periodo)
);
```

A Fase 1 entrega a forma e **uma** função:
`podeUsar(orgId, metrica) -> { pode, usado, limite }`. Sem assinatura
configurada, libera tudo — é assim que o desenvolvimento e os primeiros
clientes manuais funcionam sem página de planos.

Incremento é atômico, por RPC, nunca por leitura-e-escrita no app:

```sql
create or replace function public.consumir(p_org uuid, p_metrica text, p_qtd int default 1)
returns int language plpgsql security definer set search_path = '' as $$
declare novo int;
begin
  insert into public.usage_counters (org_id, metrica, periodo, contagem)
  values (p_org, p_metrica, date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date, p_qtd)
  on conflict (org_id, metrica, periodo)
    do update set contagem = public.usage_counters.contagem + p_qtd
  returning contagem into novo;
  return novo;
end $$;
```

O período é o mês **em Brasília**, não em UTC: o servidor roda em UTC e
virar o mês um dia antes já causou erro de relatório neste projeto.

---

## Isolamento

O banco é quem impõe. O app passa a usar o token da pessoa; `service_role`
vira exceção numerada (cron, webhook de pagamento), cada uma com
justificativa no código.

Duas funções `security definer` — definer **de propósito**, porque uma
policy que consulta `memberships` com RLS ligado em `memberships` recursiona:

```sql
create or replace function public.e_membro(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.papel_na_org(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.papel from public.memberships m
   where m.org_id = p_org and m.user_id = auth.uid();
$$;
```

`set search_path = ''` não é enfeite: é a mesma blindagem que a migration
`pin_search_path_touch_updated_at` já aplicou no briefing_app.

Toda tabela recebe o mesmo molde:

```sql
alter table public.X enable row level security;
revoke all on public.X from anon;

create policy X_sel on public.X for select to authenticated using (public.e_membro(org_id));
create policy X_ins on public.X for insert to authenticated with check (public.e_membro(org_id));
create policy X_upd on public.X for update to authenticated
  using (public.e_membro(org_id)) with check (public.e_membro(org_id));
create policy X_del on public.X for delete to authenticated using (public.e_membro(org_id));
```

Onde o papel importa (apagar a organização, convidar, editar configuração),
a policy soma `public.papel_na_org(org_id) in ('owner','admin')`.

**O que NÃO se repete deste histórico:** o proposta_app tem
`for all to authenticated using (true)`. Num produto com estranhos dentro
isso significa "qualquer cliente lê tudo de todos". E o briefing_app não usa
RLS de verdade — é deny-all com `service_role` e o isolamento mora no código,
modelo que nesta mesma operação produziu dois vazamentos em um mês (a tomada
de conta em `/api/cliente/contrato` e o papel "básico" passando pelo escopo
nas escritas).

### O nascimento da organização

Criar organização não cabe em RLS: no instante do insert a pessoa ainda não
é membro de nada, então a policy barraria. Uma função `security definer`
resolve numa transação só, sem `service_role` no app:

```sql
create or replace function public.criar_org(p_nome text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare nova uuid;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  insert into public.orgs (nome, slug) values (p_nome, public.slug_livre(p_nome))
    returning id into nova;
  insert into public.memberships (org_id, user_id, papel) values (nova, auth.uid(), 'owner');
  perform public.semear_configuracao(nova);
  return nova;
end $$;
```

`semear_configuracao` insere o conjunto padrão de tipos de projeto, etapas,
status e áreas, que o dono depois edita. É o equivalente editável dos "11
tipos de projeto" do produto de referência.

---

## Autenticação e papéis

Supabase Auth, e-mail com senha mais link mágico. **Senha compartilhada não
existe em nenhum momento** — foi ela que anulou a conta individual no
briefing_app, com valor padrão dentro de um repositório público.

O `proxy.ts` vem do `middleware.ts` do proposta_app, que já resolveu o
problema certo: verificação local do JWT por `getClaims()` com JWKS
assimétrico, e teto de 4s pra não derrubar o site quando o Auth engasga.
Dois ajustes:

1. O arquivo chama `proxy.ts`. No Next 16 `middleware` está deprecado e
   renomeado — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
2. Ele **não** autoriza nada. Decide redirecionar quem não tem sessão, e
   nada mais. O guia avisa que Proxy não deve depender de módulo ou global
   compartilhado, e a regra da casa já era essa: autenticação não é
   autorização.

As regras de papel ficam em funções puras, sem `next/headers` e sem cliente
Supabase, no padrão do `src/lib/permissoes.ts` do briefing_app — foi assim
que elas passaram a ser testáveis lá, e autorização é o código que mais
merece teste porque o erro não aparece na tela.

Papéis da Fase 1, e só eles:

| Papel | Alcance |
|---|---|
| `owner` | tudo, inclusive assinatura e exclusão da organização; único, indelével |
| `admin` | tudo menos assinatura e exclusão da organização |
| `membro` | lê e escreve os dados da organização; não convida nem configura |

`basico` e `desenvolvedor` do briefing_app **não** vêm. "Desenvolvedor" só
existe lá porque a Fysi tem um. Papel é barato de acrescentar e caro de
tirar.

---

## Onde roda

VPS própria com Docker e EasyPanel, na conta da Karine. O briefing_app hoje
está numa conta da Vercel que não é dela — o que a impede de configurar
variável de ambiente do próprio sistema. O SaaS não repete isso.

**A imagem é construída fora da VPS**, em GitHub Actions, e a VPS só baixa e
roda. Motivo: `next build` numa máquina básica de 2 GB estoura memória, e o
`wa-server` do WhatsApp disputa RAM na mesma máquina a partir da Fase 3.

`next.config.ts`, com o que o auto-hospedado exige:

```ts
export default {
  output: 'standalone',
  // o teto de 4,5 MB era da Vercel; aqui quem decide é esta linha
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  // sem isto, quem está com a aba aberta durante um deploy recebe
  // "Server Function não encontrada"
  deploymentId: process.env.DEPLOYMENT_VERSION,
  async headers() {
    return [{
      source: '/:path*{/}?',
      // sem isto, loading.tsx e Suspense ficam parados atrás do proxy
      headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
    }];
  },
};
```

Mais: `sharp` instalado na imagem (e, em Linux glibc, o ajuste de alocador
que o guia aponta, senão a otimização de imagem come RAM), proxy reverso na
frente — obrigatório, é ele que trata requisição malformada, conexão lenta,
teto de carga e limite de taxa —, e desligamento gracioso por SIGTERM com
30s de dreno, pra requisição em andamento e `after()` terminarem.

Cron é do sistema operacional batendo numa rota autenticada. Sem o limite de
1x/dia da Hobby, e sem o risco de um cron a mais travar todo deploy em
silêncio.

**Custo da Fase 1: R$ 0.** VPS já paga, Supabase em organização nova no
plano gratuito. No primeiro cliente pagante, o Supabase precisa ir pra Pro
(US$ 25/mês) por causa de backup diário e da pausa após 7 dias sem acesso —
não dá pra prometer a cliente sem isso.

---

## Como eu provo que isolou

O produto desta fase é um teste, não uma tela. Node test runner, igual ao
`npm test` do briefing_app, rodando contra um Supabase local (`supabase
start`, grátis).

**O teste de vazamento.** Duas organizações, duas pessoas, e para cada
tabela: a pessoa da organização A não lê, não escreve, não atualiza e não
apaga linha da B. Por consulta direta, por id adivinhado, e com a sessão da
A tentando `org_id` da B no corpo do insert. Enquanto esse teste não passar,
"é multi-inquilino" é afirmação, não fato.

**O teste de cobertura de policy.** Varre `pg_tables` e falha se existir
tabela em `public` sem RLS ligada, ou com RLS e zero policy, ou sem coluna
`org_id` (lista de exceção explícita: `plans`). É o teste que pega a tabela
nova que alguém criou e esqueceu de proteger — o erro mais provável desta
arquitetura.

**Os testes de papel**, puros, no formato de `testes/permissoes.test.ts`:
matriz de quem pode o quê, incluindo que `owner` não pode ser removido e que
`membro` não convida.

**O teste de cota:** `consumir` chamado em paralelo não perde contagem, e o
período vira no fuso de Brasília, não no UTC.

---

## O que a Fase 1 entrega na tela

Criar conta, criar organização, trocar de organização, convidar membro por
e-mail, listar e remover membro, e a tela de configuração (tipos de projeto,
etapas, status, áreas). **Nenhuma tela de produto.**

### Mais três peças de plataforma

Acrescentadas em 09/10 depois da varredura tela por tela do gestao.dev. Eu
as tratava como parte de módulo; são de plataforma, e construí-las uma vez
deixa as nove telas de lista das fases seguintes quase de graça.

**1. A casca de tela de lista.** Todas as telas de lista deles têm a mesma
forma: `Lista · Filtros · entidade · estado vazio que aponta o próximo passo
· Resumo lateral com contadores`. Um componente, nove usos. O estado vazio
recebe texto e ação por parâmetro — "Conecte um gateway para cobrar. Ligue a
conta do seu gateway e o dinheiro cai direto nela" vende melhor que
"nenhum registro".

**2. O selo de cota, na própria tela.** O limite não aparece só na página de
planos: o cabeçalho de Propostas diz "0 de 10 propostas este mês" com
"Fazer upgrade" ao lado. Componente servidor que lê `usage_counters` e
`plans`. Sem assinatura configurada, não renderiza nada.

**3. A página de recurso bloqueado.** Cada módulo fora do plano tem a sua,
dizendo o que ele faz e qual plano libera. O item **continua no menu**, com
cadeado — esconder tira a chance de vender. Recebe título, explicação e
plano mínimo por parâmetro.

Nenhuma das três precisa de cobrança funcionando: todas leem a estrutura de
cota que esta fase já cria.

## Riscos abertos

1. **RAM e núcleos da VPS não conhecidos.** O desenho assume o pior caso
   (build fora da máquina). Se a básica for de 1 GB, até rodar aperta, e o
   `wa-server` na mesma máquina a partir da Fase 3 agrava.
2. **Supabase gratuito pausa após 7 dias sem acesso.** Atrapalha
   desenvolvimento intermitente; some no Pro.
3. **O teste de vazamento depende de Docker local** (`supabase start`). Se
   não rodar na máquina dela, cai pra um projeto Supabase descartável.
4. **O mercado escolhido é o do produto de referência.** Decisão dela,
   registrada: a aposta é o diferencial de intake, não a paridade de
   funcionalidade.
