# Pré-requisitos de sistema — SaaS de gestão por projeto

> **Nome do produto: a definir.** Codinome de trabalho: `projeto-saas`.
> Enquanto não houver nome, nada de logo, domínio ou copy de marca.

**Objetivo.** Vender, como produto, a operação que hoje roda em dois
sistemas internos da Fysi — do primeiro contato até a entrega — para
qualquer prestador que venda por projeto.

**Tipo.** SaaS multi-inquilino, assinatura mensal, autosserviço.

**Público-alvo.** Prestador que vende por projeto e hoje controla isso em
planilha e WhatsApp: consultoria, arquitetura, advocacia, dev, design,
marketing. De uma pessoa a dez. Brasil, português, Pix e nota fiscal de
serviço.

**Diferencial.** Os concorrentes começam quando você já sabe o que propor.
Aqui a conversa do WhatsApp chega sozinha, a I.A. redige a proposta a partir
dela, e o cliente preenche o briefing por link. **Conversa vira escopo
fechado** — e escopo mal levantado é a dor de todo prestador que vende por
projeto, não só de agência.

**Stack.** Next.js 16 (App Router, React 19), TypeScript, Tailwind 4,
Supabase (Postgres + Auth + Storage), Docker em VPS própria com EasyPanel.
Mesma pilha dos dois sistemas de origem, que é o que torna o reuso viável.

---

## 0. Checagem de escopo contra o produto de referência

Varredura feita em 09/10/2026 na conta real do gestao.dev, tela por tela.

| O que eles têm | Nós temos de onde | Fase |
|---|---|---|
| Dashboard com período, 8 indicadores e 11 gráficos | briefing_app (Visão Geral) | 4 |
| Contatos com esteira Lead → Prospecção → Negociação → Cliente ativo → Inativo | briefing_app (clients) + proposta_app (leads) | 2 |
| Projetos com valor total, em andamento, ticket médio | briefing_app (project_tasks, status) | 4 |
| Tarefas: total, concluídas, pendentes, atrasadas | briefing_app (quadro, demandas) | 4 |
| Propostas com link, aceite e recusa | **proposta_app** (`/p/[slug]`, layouts, orçamento) | 2 |
| Contratos com assinatura eletrônica | integração (hoje Autentique na Fysi) | 2 |
| Cobranças pelo gateway **do próprio usuário** | integração nova | 5 |
| Assinaturas: recorrência mensal/trimestral/anual, MRR | integração nova | 5 |
| Notas fiscais pelo emissor **do próprio usuário** | integração nova | 5 |
| Metas com progresso e alerta de atenção | briefing_app (marketing_goals) | 4 |
| Precificação a partir do valor/hora mínimo | **proposta_app `lib/pricing.ts`**, que faz mais | 2 |
| Automações: 11 gatilhos × 8 ações, sem código | nada; desenho novo | 5 |
| WhatsApp **como canal de comando** (você manda mensagem, ele cria) | proposta_app (wa-server) | 3 |
| Integrações: 16 conectores | — | 2 e 5 |
| MCP próprio | — | 5 |
| Colaboradores com permissão por área (só no plano Equipe) | briefing_app (`permissoes.ts`, áreas) | 1 |
| Personalização: logo e cor na proposta e no checkout | proposta_app (escolha de visual) | 2 |
| Relatórios por e-mail: dia, semana, mês, desligáveis | briefing_app (notificações) | 4 |
| Onboarding com I.A. lendo documentos pra montar seus modelos | briefing_app (modelos de briefing) | 3 |
| Planos, cotas e limites por plano | — | 1 (forma) e 5 (venda) |
| Aplicativo de iPhone | **fora de escopo** | — |

### O que nós temos e eles não

Briefing como documento que o cliente preenche por link · Informações
Iniciais · copy aprovada pelo cliente · moodboard · área do cliente com
entrega · banco de processos · banco de prova · ata de reunião com vários
clientes · demandas por área com dono · materiais que o cliente precisa
enviar · **a ponte de WhatsApp que ESCUTA** (a deles só recebe comando) ·
modelo de precificação por capacidade.

### O que a varredura mudou no plano

Três coisas que eu tratava como parte de módulo são, na verdade, **peças de
plataforma**, e por isso sobem pra Fase 1 — construí-las uma vez deixa as
nove telas de lista seguintes quase de graça:

1. **A casca de tela de lista.** Todas as telas deles têm a mesma forma:
   `Lista · Filtros · entidade · vazio que aponta o próximo passo · Resumo
   lateral com contadores`. Nove telas, um layout.
2. **O selo de cota na própria tela.** O limite não aparece só na página de
   planos: o cabeçalho de Propostas diz "0 de 10 propostas este mês" com
   "Fazer upgrade" ao lado. É um componente que lê `usage_counters`.
3. **A página de recurso bloqueado.** Cada módulo fora do plano tem a sua,
   explicando o que ganha e qual plano libera — em vez de esconder o menu.
   Item bloqueado continua visível, com cadeado.

E duas correções de rota:

- **Metas** não estava em nenhuma fase. Entra na 4.
- **Personalização de marca** não estava explícita, e num produto vendido a
  prestador a proposta tem que sair com a marca *dele*. Entra na 2.

---

## 1. Pré-requisitos técnicos

### Ambiente

| Item | Escolha | Observação |
|---|---|---|
| Runtime | Node 22 LTS | `next start` em modo `standalone` |
| Banco e Auth | Supabase | **desenvolvimento local** (`supabase start`, Docker) |
| Projeto Supabase na nuvem | **pendente** | a organização dela está no gratuito com 2 de 2 projetos usados; precisa de organização nova |
| Hospedagem | VPS própria, Docker + EasyPanel | proxy reverso com TLS já existente |
| Build | **GitHub Actions**, não na VPS | `next build` estoura RAM em máquina básica |
| Registro de imagem | GHCR | gratuito no plano dela |
| Cron | cron do sistema batendo em rota autenticada | sem o limite de 1x/dia da Vercel |

### Bibliotecas

Produção: `next@16`, `react@19`, `@supabase/supabase-js`, `@supabase/ssr`,
`tailwindcss@4`, `sharp` (otimização de imagem no auto-hospedado),
`lucide-react` (ícone SVG — **não** emoji).
Fases seguintes: `@blocknote/shadcn` (briefing e documento, já usado no
briefing_app), SDK da Anthropic (Fase 3), SDK do gateway escolhido (Fase 5).
Teste: `node --test` nativo, como já é no briefing_app (`npm test`).

### Configuração obrigatória do Next, por ser auto-hospedado

```ts
output: 'standalone'
experimental: { serverActions: { bodySizeLimit: '10mb' } }  // o teto de 4,5 MB era da Vercel
deploymentId: process.env.DEPLOYMENT_VERSION                 // evita "Server Function não encontrada" após deploy
headers: [{ key: 'X-Accel-Buffering', value: 'no' }]         // sem isto, Suspense não faz streaming atrás do proxy
```

`proxy.ts`, não `middleware.ts`: no Next 16 o nome antigo está deprecado.

### Chaves e segredos

Nenhum segredo no repositório — o briefing_app e o proposta_app **já foram
públicos uma vez**, com senha padrão dentro do código.

Fase 1: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(usada só em cron e webhook, cada uso numerado e justificado no código),
`DEPLOYMENT_VERSION`, `CRON_SECRET`.
Depois: `ANTHROPIC_API_KEY` (3), token do wa-server (3), credenciais de
gateway e emissor **por inquilino, cifradas no banco** (5) — nunca em
variável de ambiente, porque são de cada cliente, não nossas.

### Banco

Postgres 17. Toda tabela com `org_id uuid not null` e RLS ligada. Fuso
`America/Sao_Paulo` em tudo que vira data — o servidor roda em UTC e virar o
mês um dia antes já causou erro de relatório neste projeto.

---

## 2. Pré-requisitos funcionais

### Papéis

| Papel | Alcance |
|---|---|
| `owner` | tudo, inclusive assinatura e exclusão da organização; único e indelével |
| `admin` | tudo menos assinatura e exclusão da organização |
| `membro` | lê e escreve os dados da organização; não convida nem configura |

Fase 4 acrescenta `cliente` (acesso só ao próprio projeto, por link com
token) e permissão por área, no padrão do gestao.dev — que cobra isso no
plano mais alto.

### Módulos, por fase

**Fase 1 — Fundação.** Criar conta, criar organização, trocar de
organização, convidar e remover membro, configurar a organização (tipos de
projeto, etapas, status, áreas). Mais as três peças de plataforma: casca de
lista, selo de cota, página de recurso bloqueado.

**Fase 2 — O primeiro produto vendável.** Contato com esteira de cinco
situações → proposta com link público, aceite e recusa → contrato com
assinatura → precificação. Personalização de marca na proposta.

**Fase 3 — O diferencial.** Briefing por link com modelo por tipo de
projeto; ponte de WhatsApp multi-inquilino; I.A. que lê a conversa, o áudio
e o print e redige proposta e briefing; onboarding que lê os documentos do
assinante e monta os modelos dele.

**Fase 4 — Entrega.** Projeto com etapas, tarefas, quadro, prazos, equipe;
área do cliente; metas; dashboard; relatório por e-mail diário, semanal e
mensal, cada um desligável.

**Fase 5 — Dinheiro e autosserviço.** Cobrança e assinatura pelo gateway do
assinante; nota fiscal pelo emissor dele; automações "quando / faça";
página de planos com cobrança da própria mensalidade; MCP.

### Fluxos que precisam estar certos desde a Fase 1

1. **Nascimento da organização.** Não cabe em RLS: no instante do insert a
   pessoa ainda não é membro de nada. Resolve-se com função
   `security definer` que cria organização, vínculo de `owner` e a
   configuração semeada numa transação só.
2. **Convite.** Convite por e-mail com token de uso único e prazo. Quem
   aceita entra como `membro`. `owner` e `admin` convidam; `membro` não.
3. **Troca de organização.** A mesma pessoa pode atender duas empresas.
4. **Consumo de cota.** Incremento atômico por RPC, nunca leitura-e-escrita
   no app. Sem assinatura configurada, libera tudo.
5. **Toda escrita confirma o que gravou.** Botão que diz "Salvo" porque
   `pending` virou falso já mentiu neste projeto; o padrão é `useFormStatus`
   dentro do `<form>` e confirmação vinda do servidor.
6. **Caixa de seleção em formulário de edição** leva campo oculto `"0"`
   antes dela, e a leitura é `getAll().includes("1")`. Sem isso o campo liga
   e nunca desliga — bug que já aconteceu aqui.

---

## 3. Pré-requisitos não funcionais

### Segurança

O banco é quem isola, não o código. Policy por `org_id` em toda tabela,
resolvida por `memberships`. O app usa o token da pessoa; `service_role` é
exceção numerada.

Três coisas que vêm de erro já cometido nesta operação e não se repetem:

- **Autenticação não é autorização.** `proxy.ts` só redireciona quem não
  tem sessão. Quem decide o que a pessoa pode ver é a página, e a regra mora
  em função pura com teste.
- **Nunca uma rota GET com efeito colateral.** O `<Link>` do Next faz
  prefetch e dispara sozinho.
- **Senha compartilhada não existe.** Foi ela que anulou a conta individual
  no briefing_app, com valor padrão num repositório público.

Credencial de gateway e de emissor é de cada inquilino: cifrada no banco,
nunca em variável de ambiente, nunca em log. Teto de taxa e de tamanho de
corpo no proxy reverso, que é o papel dele.

### Desempenho

Índice em `memberships (user_id, org_id)` — sem ele toda policy varre a
tabela. Dashboard e relatório leem de consulta agregada, não de laço no
app. Resposta de lista paginada desde a primeira tela: a Fysi tem 196
clientes e 400 documentos, e um assinante pode ter mais.

### Escalabilidade

Um banco, um schema, `org_id` em tudo. Schema por inquilino é a resposta pra
quando um cliente grande exigir, e custa migration vezes N — não se faz
antes. O Next roda sem estado próprio: o cache em disco é de uma instância
só, então subir uma segunda instância exige `cacheHandler` compartilhado e
`deploymentId` — anotado, não feito agora.

### Experiência

Português em tudo, inclusive mensagem de erro. **Sem emoji na interface** —
cor, ícone SVG ou texto. Toda lista editável, ordenável e com estado vazio
que diz o que fazer em seguida, não "nenhum registro". Recurso fora do plano
aparece com cadeado e uma página que explica o que ele faz — esconder o menu
tira a chance de vender.

### Responsividade

Telefone primeiro nas telas que o cliente final abre (proposta, contrato,
briefing, área do cliente): ele vai abrir o link no celular, vindo do
WhatsApp. O painel do assinante pode assumir telas maiores, mas nenhuma
tabela pode estourar a largura.

### Como se prova que está pronto

Cada fase entrega teste, não só tela. Na Fase 1 o produto **é** o teste de
vazamento: duas organizações, duas pessoas, e para cada tabela a garantia de
que uma não lê, não escreve, não atualiza e não apaga nada da outra — por
consulta direta, por id adivinhado e forçando `org_id` alheio no corpo do
insert. Mais um teste que varre `pg_tables` e falha se existir tabela sem
RLS, com RLS e zero policy, ou sem `org_id`. É ele que pega a tabela nova
que alguém esqueceu de proteger.

---

## Decisões pendentes

1. **Nome do produto.** Bloqueia domínio, marca e a página de planos. Não
   bloqueia a Fase 1.
2. **RAM e núcleos da VPS.** O desenho assume o pior caso. Se for de 1 GB,
   até rodar aperta — e a partir da Fase 3 o `wa-server` disputa a mesma
   memória.
3. **Organização nova no Supabase.** A atual está no gratuito com 2 de 2
   projetos. Desenvolvimento roda local, sem custo, então isso só bloqueia o
   primeiro deploy.
