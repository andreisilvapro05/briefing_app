# EI como documento de blocos (estilo Notion/ClickUp)

## Contexto

O hub de Estruturas Iniciais (EI, ver `2026-08-30-estruturas-iniciais-hub-design.md`) foi implementado com `EIEditor` como um **formulário de campos fixos** (dados de acesso, links, uma lista rígida de "seções" com título/texto/CTA) — espelhando o antigo template de Word/Notion da Sara. O usuário corrigiu esse rumo em 2026-08-30: "EI deve ser um documento e não para preencher tipo formulário, puxe as EIs do ClickUp" — e, ao escolher entre as opções apresentadas, pediu especificamente um editor **de blocos, estilo Notion/ClickUp** (arrastar, reordenar, título/parágrafo/link/imagem como blocos), não um textarea único nem um meio-termo com campos fixos + um bloco de texto livre.

**Estado atual dos dados:** confirmado via SQL em 2026-08-30 — só existem 2 linhas em `ei_documents` (o "Modelo" e 1 cliente), nenhuma com conteúdo real preenchido (ambas ainda no shape vazio default). Ou seja, **não há dado real de produção pra migrar** — a troca de formato é um corte limpo, não uma migração de dados.

## Decisões já validadas com o usuário

1. **Fonte de verdade, período de transição:** importação do ClickUp é **pontual e re-executável por documento**, não uma sincronização contínua bidirecional. Depois de importado, o app é onde a equipe edita. Um botão "Importar do ClickUp" por documento permite reimportar aquele documento específico a qualquer momento durante a transição (sobrescreve só aquele doc, nunca todos de uma vez).
2. **Formato de edição:** editor de blocos de verdade — [BlockNote](https://www.blocknotejs.org/) (`@blocknote/core` + `@blocknote/react`), confirmado compatível com React 19.2 / Next 16.2 (stack atual deste repo). Tema visual deve remeter a Notion/ClickUp (tipografia limpa, handle de arrastar, menu "/" pra inserir bloco, toolbar ao selecionar texto) — customizado com os tokens de cor do admin Fysi (`fysi-deep`, `fysi-cream`, `fysi-mint`, etc.), não o tema default do BlockNote.

## Mudança de dados

`ei_documents.ei_data` já é `jsonb not null default '{}'::jsonb` — **sem migration de schema**. Só muda o que é gravado ali:

- **Antes:** shape `EIData` (`src/lib/ei-template.ts`) — campos fixos + `secoes: EISecao[]`.
- **Depois:** `{ blocks: Block[] }` — o formato nativo de blocos do BlockNote (serializável, é o que `editor.document` retorna).

Como as 2 linhas existentes não têm conteúdo real, elas são resetadas pro novo shape vazio (`{ blocks: [] }` ou um bloco de título vazio) — não precisa de lógica de conversão EIData→blocks pros dados existentes.

## Componentes afetados

- **`src/lib/ei-template.ts`** — remove `EIData`/`EISecao`/`emptyEI`/`emptySecao`/`REFERENCIAS_PADRAO` (campos fixos deixam de existir). `renderEIMarkdown()` é substituído pelo exportador de markdown nativo do BlockNote (`blocksToMarkdownLossy`). Confirmado via grep (2026-08-30): `renderEIMarkdown` só é usado dentro de `ei-editor.tsx` (botões "Copiar MD" / "Baixar .md" e o preview) — não alimenta a criação de tarefa no ClickUp (`src/lib/clickup.ts` usa seu próprio `renderMarkdown()`, a partir das respostas do briefing, sem relação com EI). Troca é isolada.
- **`src/lib/ei-documents.ts` / `src/lib/ei-documents-server.ts`** — trocam a tipagem `EIData` pelo novo tipo de blocos (`{ blocks: Block[] }`); lógica de fetch/list não muda.
- **`src/components/admin/ei-editor.tsx`** — reescrito: monta um `<BlockNoteView editor={...} theme={...} />` no lugar dos campos fixos. Autosave: troca os `onBlur` por `editor.onChange` debounced (mesmo padrão de debounce de 800ms que já existe pro fallback).
- **`src/components/admin/ei-document.tsx`** (view somente-leitura) — **eliminado**. Com BlockNote, a MESMA instância de editor serve leitura e escrita (`editable={false}` vs `true`); não precisa de dois componentes renderizando o mesmo conteúdo de formas diferentes.
- **`src/components/admin/ei-view.tsx`** — simplifica: remove o toggle "Documento" / "Editar" (não faz mais sentido — em Notion/ClickUp você só clica na página e edita direto). Vira só o wrapper que busca o doc e renderiza o editor de blocos, sempre editável (autosave já cobre o "salvar").
- **`src/app/admin/estruturas-iniciais/actions.ts`** (`updateEIDocumentAction`) — já é genérico o suficiente (recebe `eiJson`, grava em `ei_data` sem validar shape); só troca o tipo `EIData` pelo novo tipo de blocos no cast. Nenhuma mudança de lógica.

## Importação do ClickUp (bloqueada — falta informação)

Ainda preciso do usuário:
1. **Link ou ID do doc "EI's - 2026" no ClickUp** (e workspace) — pra um teste real de fetch antes de fechar o design da importação.
2. **Como as ~59 páginas mapeiam pros clientes** — cada página é nomeada com o nome do cliente/empresa? Existe uma estrutura de pastas dentro do doc? Preciso disso pra decidir como o botão "Importar do ClickUp" de um documento específico sabe qual página buscar (por nome? o admin escolhe manualmente numa lista?).

Desenho preliminar (a confirmar após ter o link):
- Novo `src/lib/clickup-docs.ts` — usa a ClickUp API v3 (`GET /v3/workspaces/{workspace_id}/docs/{doc_id}`, endpoint de listagem de páginas), diferente da v2 (Tasks) já usada em `src/lib/clickup.ts`. Mesma env var `CLICKUP_API_TOKEN` (a confirmar se o token atual tem escopo de leitura de Docs).
- Server action nova (`importEIFromClickUpAction`) busca o markdown/conteúdo bruto da página (token fica no servidor) e devolve pro client.
- No client, o parser de markdown→blocks do próprio BlockNote (`editor.tryParseMarkdownToBlocks`) converte o conteúdo recebido; o resultado vira o novo `blocks` do documento e salva pelo mesmo autosave já existente.

## Fora de escopo

- Sincronização contínua/automática com o ClickUp (explicitamente descartada pelo usuário nessa rodada).
- Colaboração em tempo real entre múltiplos usuários editando o mesmo doc (BlockNote suporta via Yjs, mas não foi pedido — YAGNI).
- Upload de imagem embutido no editor (bloco de imagem do BlockNote aceita URL; upload de arquivo pro Drive/Storage fica pra uma rodada futura se for pedido).
