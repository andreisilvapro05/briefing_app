# Estruturas Iniciais (EI) — Hub de documentos — Design

## 1. Contexto e problema

A equipe usa hoje um doc do ClickUp ("EI's - 2026") com uma página por
cliente/projeto (ex: "EI - Katlyn", "EI - César") mais uma página fixa
"EI - Modelo" que serve de ponto de partida — a equipe duplica o Modelo
pra começar a EI de um cliente novo. Cada página segue a mesma estrutura:
dados de acesso, briefing, drive/logo/imagens/fonte/cores, referências
visuais, e uma seção por bloco da página final (SEÇÃO 01, 02, ...) com
observação interna, referência visual, título e texto/copy.

O app já tem uma implementação parcial disso: `clients.ei_data` (jsonb,
migration `20260601000000_add_ei_data.sql`) com a mesma forma de dados
(`src/lib/ei-template.ts`, tipo `EIData`), editada via `EIEditor`
(`src/components/admin/ei-editor.tsx`) dentro da aba "EI" da ficha do
cliente (`/admin/[id]?tab=ei`). Mas:

1. É um **formulário** (fieldsets com inputs em caixinha) — nada parecido
   com a experiência de "ler/editar um documento" que a equipe tem hoje no
   ClickUp.
2. Não existe conceito de **Modelo** no app — cada EI começa do zero
   (`emptyEI()`, todos os campos vazios). Não há como duplicar um ponto de
   partida.
3. EI só existe **dentro da ficha de um cliente** — não há uma visão
   central com todas as EIs juntas, do jeito que a lista de páginas do doc
   do ClickUp mostra (ver print anexado à conversa: sidebar com "EI -
   Modelo" fixado no topo, depois uma página por cliente).
4. `clients.ei_data` está vazio pra todos os 35 clientes hoje
   (confirmado via SQL em 2026-08-30) — a feature existe no código mas
   nunca foi adotada pela equipe. A adoção real ainda depende de trazer o
   conteúdo das ~59 páginas do ClickUp pra dentro do app — isso é
   trabalho futuro, fora do escopo deste spec (ver §7).

## 2. Objetivo

Dar à equipe um lugar no app que substitua o doc do ClickUp pra criar e
manter as EIs: uma área central ("hub") com todos os documentos —
incluindo o Modelo, que **não tem cliente associado** — navegável como
uma lista de páginas, com o documento em formato de leitura (não
formulário), edição inline com autosave, e "duplicar do Modelo" ao criar
uma EI nova pra um cliente.

## 3. Fora de escopo (nesta rodada)

- **Migrar o conteúdo das ~59 páginas reais do ClickUp** pro app. Este
  spec entrega a estrutura pronta pra receber esse conteúdo; a migração
  em si (ler cada página do ClickUp, casar com o cliente certo no banco,
  popular `ei_data`) é um próximo passo, decidido explicitamente pelo
  usuário como "depois" em 2026-08-30.
- **Reorganizar a navegação em "Projetos Externos/Internos".** O usuário
  mencionou essa ideia maior (Estruturas Iniciais e Tarefas por projeto
  vivendo dentro de "Projetos Internos"), mas decidiu adiar — aqui
  "Estruturas Iniciais" entra como mais um item dentro da área "Projetos"
  que já existe, sem mexer na estrutura da nav.
- **Unificar o status do cliente/projeto** com a taxonomia de 13 status
  do ClickUp — item de backlog separado, não relacionado a EI.
- Excluir um documento EI (não foi pedido; se precisar depois, é um botão
  a mais, sem mudança de modelo de dados).

## 4. Modelo de dados

Tabela nova `ei_documents`, desacoplada de `clients` — é o que permite o
Modelo (sem cliente) e as EIs de cliente ficarem juntos na mesma lista.

```sql
create table public.ei_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  nome text,
  is_template boolean not null default false,
  ei_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- no máx. 1 documento por cliente
create unique index ei_documents_client_unique
  on public.ei_documents(client_id) where client_id is not null;

-- no máx. 1 template (o Modelo)
create unique index ei_documents_one_template
  on public.ei_documents(is_template) where is_template;
```

- `nome`: só usado quando `client_id is null` (hoje, só o Modelo — nome
  fixo "Modelo"). Quando `client_id` não é nulo, o título exibido é
  derivado ao vivo do cliente (`empresa` ou `nome`) via join — evita
  título desatualizado se o cliente for renomeado depois.
- `ei_data`: mesma forma `EIData` que já existe (`src/lib/ei-template.ts`)
  — reaproveitada sem mudança de schema interno.
- RLS habilitada, sem policy pública — mesmo padrão de `project_tasks`
  (só `service-role` no backend lê/escreve).
- `clients.ei_data`/`clients.ei_atualizado_at` **continuam existindo**,
  não são apagados nesta rodada — só deixam de ser lidos pelo app
  (dado que hoje estão vazios pra todo mundo, não há nada real pra
  perder). Um cleanup futuro pode dropar essas colunas depois que
  confirmarmos que nada mais lê delas.
- A migration que cria a tabela já semeia o Modelo (`is_template = true`,
  `ei_data = '{}'`) e faz o backfill de qualquer `clients.ei_data`
  não-nulo pra uma linha correspondente — idempotente, mas hoje é um
  no-op (0 de 35 clientes têm `ei_data` preenchido).

## 5. Navegação

Novo item **"Estruturas Iniciais"** na área "Projetos" do `AdminShell`
(`src/components/admin/admin-shell.tsx`), ao lado de Clientes / Lista por
status / Briefings / Quadro. Ícone de documento (mesmo estilo dos outros,
`<I>` com stroke).

A aba "EI" que já existe na ficha do cliente (`/admin/[id]?tab=ei`)
deixa de embutir o formulário inteiro. Vira um card simples:

- Se o cliente já tem um documento em `ei_documents`: um link **"Abrir
  Estrutura Inicial ↗"** que leva pro hub já com esse documento
  selecionado.
- Se não tem: texto "Nenhuma Estrutura Inicial ainda" + botão **"Criar
  a partir do Modelo"** que já cria o documento (duplicado do Modelo,
  ver §6.3) e redireciona pro hub.

## 6. O hub (`/admin/estruturas-iniciais`)

### 6.1 Layout

Duas colunas dentro do `AdminShell` (que já cuida da sidebar de áreas +
topbar):

- **Sidebar de documentos** (esquerda, largura fixa ~280px): campo de
  busca no topo, depois a lista — "Modelo" sempre fixado primeiro (com
  um marcador visual, ex. ícone de estrela ou badge "Modelo"), depois os
  documentos de cliente em ordem alfabética por título. Cada item mostra
  o título e é um link (Next `<Link>`) pra
  `/admin/estruturas-iniciais/[docId]`.
- **Painel do documento** (direita, ocupa o resto): reaproveita o par
  `EIView`/`EIDocument` que já existe (`src/components/admin/ei-view.tsx`,
  `ei-document.tsx`, commit `d7d3782` de julho) — toggle "Documento" /
  "Editar" já pronto e já com a cara certa (título grande, metadados,
  labels em caixa alta como tag, texto corrido, sem fieldsets em caixa).
  Não precisa reconstruir esse visual do zero. O que muda: `EIView` passa
  a receber os dados de um `ei_documents` (via `docId`), não mais de um
  `client_id` direto; e o modo "Editar" (`EIEditor`) troca o botão
  "Salvar EI" por autosave por campo (ver §6.2).

Rotas:
- `/admin/estruturas-iniciais` → redireciona pro Modelo (sempre existe,
  a migration garante isso).
- `/admin/estruturas-iniciais/[docId]` → hub com esse documento aberto.

### 6.2 Edição — autosave por campo

Sem botão "Salvar" geral. Cada campo (input de uma linha ou bloco de
texto) salva sozinho no `onBlur`. Indicador discreto no topo do painel
("Salvo" / "Salvando..." / horário da última alteração), mesmo padrão
textual que já existe no `EIEditor` atual (`Salvo em {hora}`), só que
disparado automaticamname em vez de por clique.

Implementação: `EIEditor` já mantém o `EIData` completo em estado local
e já serializa o objeto inteiro pra salvar (hoje via `setEIAction`,
disparado pelo botão "Salvar EI"). A mudança é: (1) trocar `setEIAction`
por `updateEIDocumentAction` (grava em `ei_documents` por `docId`, não
mais em `clients` por `clientId`); (2) adicionar `onBlur={save}` em cada
campo (`Input`/`Textarea`, inclusive os de cada seção dinâmica) e remover
o botão "Salvar EI"; o indicador "Salvo em {hora}" que já existe continua
igual, só passa a atualizar sozinho a cada blur em vez de a cada clique.
Cada blur reenvia o objeto `EIData` inteiro — barato, um único UPDATE.

### 6.3 Criar um documento novo

Botão **"+ Nova Estrutura Inicial"** no topo da sidebar → modal/select
simples listando clientes que **ainda não têm** documento (join
`ei_documents` × `clients`, filtra os que não aparecem) → ao confirmar,
cria a linha em `ei_documents` com `ei_data` copiado do Modelo atual, e
navega pro documento recém-criado. Mesmo padrão de "Gerar tarefas do
template" que já existe (`seedProjectTasksAction`).

O Modelo em si não precisa de um fluxo de criação — ele já existe desde
a migration (linha única, `is_template = true`).

## 7. Fora de escopo, mas relevante (registrar como próximo passo)

Depois que este hub estiver no ar, o próximo passo natural — já
sinalizado pelo usuário como "depois vamos migrar" — é trazer o conteúdo
das ~59 páginas reais do doc "EI's - 2026" do ClickUp pra dentro de
`ei_documents`, casando cada página com o `client_id` certo. Isso é
trabalho de migração de dados (não de código) e fica pra uma rodada
separada.

## 8. Arquivos afetados

**Novos:**
- `supabase/migrations/<timestamp>_add_ei_documents.sql` — tabela,
  índices, RLS, trigger `touch_updated_at`, seed do Modelo + backfill.
- `src/lib/ei-documents-server.ts` — `listEIDocuments()` (join com
  clients pro título), `getEIDocument(id)`, `getTemplateDocument()`.
- `src/app/admin/estruturas-iniciais/page.tsx` — redireciona pro Modelo.
- `src/app/admin/estruturas-iniciais/[docId]/page.tsx` — server
  component, monta `AdminShell` + sidebar + painel.
- `src/app/admin/estruturas-iniciais/actions.ts` — `createEIDocumentAction`,
  `updateEIDocumentAction` (autosave).
- `src/components/admin/ei-document-sidebar.tsx` — lista + busca + botão
  de criar.

**Modificados:**
- `src/components/admin/ei-editor.tsx` — troca `clientId`+`setEIAction`
  por `docId`+`updateEIDocumentAction`; remove o botão "Salvar EI" e
  adiciona `onBlur` de autosave em cada campo. Visual não muda (o
  formulário em si continua o mesmo, só o gatilho de salvar).
- `src/components/admin/ei-view.tsx` — troca as props ligadas a cliente
  (`clientId`) pelas ligadas a documento (`docId`); `EIDocument` recebe
  os mesmos dados de sempre (não muda).
- `src/components/admin/admin-shell.tsx` — novo item de nav
  "Estruturas Iniciais" na área Projetos.
- `src/app/admin/[id]/page.tsx` — aba "ei" vira card com link/criar em
  vez do `EIView` embutido.
- `src/app/admin/[id]/actions.ts` — `setEIAction` fica sem uso (a
  gravação passa a ser via `updateEIDocumentAction`); remover depois de
  confirmar que nada mais chama.

## 9. Auto-revisão do spec

- Sem "TBD" pendente — as decisões de armazenamento, navegação, visual e
  criação foram todas confirmadas com o usuário durante o brainstorm
  (2026-08-30).
- Escopo focado: não inclui a reorganização de nav maior nem a migração
  do conteúdo real do ClickUp — ambos citados explicitamente como fora
  de escopo, com prompt textual do próprio usuário sustentando a decisão.
- Consistência: `ei_data` mantém o mesmo shape (`EIData`) do que já
  existe hoje — não há mudança de schema interno do JSON, só de onde ele
  mora (`ei_documents` em vez de `clients.ei_data`) e de como é editado.
