# EI como documento de blocos (BlockNote) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o editor de EI (Estrutura Inicial) de um formulário de campos fixos por um editor de blocos estilo Notion/ClickUp, editável e legível na mesma tela — sem toggle "Documento"/"Editar".

**Architecture:** `@blocknote/react` + `@blocknote/shadcn` (não `@blocknote/mantine` — este projeto já usa shadcn/ui + Tailwind em `src/components/ui/`, sem Mantine em nenhum outro lugar). `ei_documents.ei_data` (jsonb, sem migration de schema) passa a guardar `{ blocks: Block[] }` no lugar do shape `EIData` antigo. Um único componente de editor serve leitura e escrita.

**Tech Stack:** Next.js 16.2 / React 19.2 (App Router, Server Actions) · Supabase (service-role client) · `@blocknote/core` + `@blocknote/react` + `@blocknote/shadcn` · Tailwind (tokens Fysi em `src/app/globals.css`)

**Spec:** `docs/superpowers/specs/2026-08-30-ei-documento-blocos-design.md`

## Global Constraints

- Não criar migration de schema — `ei_documents.ei_data` já é `jsonb not null default '{}'::jsonb`.
- Nenhum conteúdo real existe hoje nas 2 linhas de `ei_documents` (confirmado via SQL em 2026-08-30) — pode resetar pro novo shape sem lógica de conversão.
- `@blocknote/shadcn`, não `@blocknote/mantine` — este projeto usa Tailwind + shadcn/ui (`src/components/ui/`, `src/lib/cn.ts`), não Mantine.
- Tema do editor deve usar os tokens Fysi já definidos em `src/app/globals.css`: `--fysi-deep: #042B30`, `--fysi-cream: #F7F6F4`, `--fysi-mint: #BFEDE0`, `--fysi-mint-vivid: #8DE2C5`, `--fysi-yellow: #F4F99D`, `--fysi-line: #E5E5E0`, `--fysi-muted: #6B7472`.
- A importação do conteúdo real do ClickUp (~59 páginas) fica **fora deste plano** — bloqueada até ter o link/ID do doc e o mapeamento página→cliente (ver spec, seção "Importação do ClickUp"). Este plano só entrega o editor funcionando vazio/pronto pra digitar.

---

### Task 1: Instalar BlockNote e validar que builda

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: pacotes `@blocknote/core`, `@blocknote/react`, `@blocknote/shadcn` disponíveis pra import em qualquer client component.

- [ ] **Step 1: Instalar os pacotes**

```bash
npm install @blocknote/core @blocknote/react @blocknote/shadcn
```

- [ ] **Step 2: Rodar build pra garantir que a instalação não quebra nada**

Run: `npm run build`
Expected: build passa (mesmo sem nenhum código novo ainda usando os pacotes — só confirma que a instalação não colide com versões existentes de React/Next).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instala BlockNote (editor de blocos pra EI)"
```

---

### Task 2: Componente `EIBlockEditor` — editor funcional mínimo, sem tema custom ainda

**Files:**
- Create: `src/components/admin/ei-block-editor.tsx`
- Test: verificação manual via Task 4 (este componente não é renderizado em nenhuma rota até lá — ver nota abaixo)

**Interfaces:**
- Consumes: nada de outras tasks deste plano.
- Produces: `EIBlockEditor({ docId, urlKey, initialBlocks, atualizadoAt }: EIBlockEditorProps)` — componente client (`"use client"`). `initialBlocks: PartialBlock[] | null` (formato nativo do BlockNote; `null` = documento vazio, editor cria um bloco de parágrafo vazio). Exporta também `type EIBlockEditorProps` pra Task 4 importar.

- [ ] **Step 1: Escrever o componente**

```tsx
// src/components/admin/ei-block-editor.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { updateEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";

export interface EIBlockEditorProps {
  docId: string;
  urlKey: string | null;
  initialBlocks: PartialBlock[] | null;
  atualizadoAt: string | null;
}

export function EIBlockEditor({
  docId,
  urlKey,
  initialBlocks,
  atualizadoAt,
}: EIBlockEditorProps) {
  const editor = useCreateBlockNote({
    initialContent:
      initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined,
  });

  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(atualizadoAt);
  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    const fd = new FormData();
    fd.append("docId", docId);
    if (urlKey) fd.append("key", urlKey);
    fd.append("eiJson", JSON.stringify({ blocks: editor.document }));
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateEIDocumentAction(fd);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : "Erro ao salvar. Tente de novo em alguns segundos."
        );
      }
    });
  }

  // Autosave debounced — mesmo padrão já usado no editor de campos fixos
  // (EIEditor) antes desta troca: dispara em qualquer mudança de conteúdo,
  // 800ms depois da última edição, ignorando o mount inicial.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      const timeout = setTimeout(save, 800);
      return () => clearTimeout(timeout);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <p className="text-xs text-fysi-muted">
          {savedAt ? (
            <span>Salvo em {new Date(savedAt).toLocaleString("pt-BR")}</span>
          ) : (
            <span className="text-amber-700">Nunca salvo</span>
          )}
        </p>
        {pending ? (
          <span className="text-xs text-fysi-muted">Salvando…</span>
        ) : null}
      </div>
      {saveError ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mb-3 inline-block">
          ⚠ {saveError}
        </p>
      ) : null}
      <BlockNoteView editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `ei-block-editor.tsx` (o arquivo ainda não é importado por nada, então erros em outros arquivos não relacionados a esta task podem preexistir — só cuidar dos daqui).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ei-block-editor.tsx
git commit -m "feat: EIBlockEditor — editor de blocos BlockNote pra EI (ainda não conectado)"
```

---

### Task 3: Tema Fysi pro editor (Notion/ClickUp na cara, cores da marca)

**Files:**
- Modify: `src/components/admin/ei-block-editor.tsx`

**Interfaces:**
- Consumes: `EIBlockEditor` de Task 2.
- Produces: mesmo componente, agora com `theme` aplicado — nenhuma mudança de interface pública.

- [ ] **Step 1: Adicionar o tema custom, usando as cores Fysi**

```tsx
// no topo de src/components/admin/ei-block-editor.tsx, junto aos outros imports:
import type { Theme } from "@blocknote/shadcn";
```

```tsx
// antes da definição do componente EIBlockEditor:
const fysiTheme: Theme = {
  colors: {
    editor: { text: "#042B30", background: "#ffffff" },
    menu: { text: "#042B30", background: "#ffffff" },
    tooltip: { text: "#F7F6F4", background: "#042B30" },
    hovered: { text: "#042B30", background: "#F7F6F4" },
    selected: { text: "#042B30", background: "#BFEDE0" },
    disabled: { text: "#6B7472", background: "#F7F6F4" },
    shadow: "#E5E5E0",
    border: "#E5E5E0",
    sideMenu: "#6B7472",
  },
  borderRadius: 10,
  fontFamily: "inherit",
};
```

```tsx
// troca a linha final do JSX:
      <BlockNoteView editor={editor} theme={fysiTheme} />
```

- [ ] **Step 2: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `Theme` não for exportado de `@blocknote/shadcn` (só de `@blocknote/core` ou `@blocknote/react` nessa versão instalada), ajustar o import de acordo com o que o typecheck apontar — os três pacotes reexportam tipos entre si e a mensagem de erro do TS aponta o caminho certo.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ei-block-editor.tsx
git commit -m "style: tema Fysi (cores da marca) no editor de blocos da EI"
```

---

### Task 4: Trocar `updateEIDocumentAction`, `EIView` e as páginas de Estruturas Iniciais pro novo editor

**Files:**
- Modify: `src/app/admin/estruturas-iniciais/actions.ts`
- Modify: `src/components/admin/ei-view.tsx`
- Modify: `src/app/admin/estruturas-iniciais/[id]/page.tsx` (ou o nome real do arquivo de página que renderiza `EIView` — confirmar com `grep -rn "EIView" src/app` antes de editar, o caminho exato pode variar)
- Delete: `src/components/admin/ei-editor.tsx`
- Delete: `src/components/admin/ei-document.tsx`

**Interfaces:**
- Consumes: `EIBlockEditor`/`EIBlockEditorProps` de Task 3.
- Produces: `EIView` com uma prop nova `initialBlocks: PartialBlock[] | null` no lugar de `initial: EIData | null`.

- [ ] **Step 1: Achar todos os callers de `EIView` e `EIEditor`/`EIDocument`**

Run: `grep -rn "EIView\|ei-editor\|ei-document\b" src/app src/components --include="*.tsx" --include="*.ts"`
Expected: lista de arquivos que passam `initial: EIData` pra `EIView` — normalmente a página que busca o doc via `ei-documents-server.ts` e a aba antiga na ficha do cliente (`src/app/admin/[id]/page.tsx`, que hoje só linka pro hub — conferir se ainda importa algo de EI).

- [ ] **Step 2: Atualizar `updateEIDocumentAction` pra aceitar o novo shape**

Em `src/app/admin/estruturas-iniciais/actions.ts`, a função já é genérica (recebe `eiJson`, faz `JSON.parse` e grava em `ei_data` sem validar shape). Só troca o tipo do cast:

```ts
// antes:
let parsed: EIData;
try {
  parsed = JSON.parse(raw) as EIData;
} catch {
  return;
}
```

```ts
// depois:
let parsed: { blocks: unknown[] };
try {
  parsed = JSON.parse(raw) as { blocks: unknown[] };
} catch {
  return;
}
```

Remove o import de `EIData`/`emptyEI` desse arquivo se não sobrar nenhum outro uso (conferir com `grep -n "EIData\|emptyEI" src/app/admin/estruturas-iniciais/actions.ts` depois da troca).

- [ ] **Step 3: Simplificar `EIView`**

```tsx
// src/components/admin/ei-view.tsx
"use client";

import { EIBlockEditor } from "./ei-block-editor";
import type { PartialBlock } from "@blocknote/core";

export function EIView(props: {
  docId: string;
  urlKey: string | null;
  initialBlocks: PartialBlock[] | null;
  atualizadoAt: string | null;
}) {
  return (
    <EIBlockEditor
      docId={props.docId}
      urlKey={props.urlKey}
      initialBlocks={props.initialBlocks}
      atualizadoAt={props.atualizadoAt}
    />
  );
}
```

Remove as props que só faziam sentido pro formulário antigo (`clientName`, `empresa`, `fallbackDrive`) — se a página que chama `EIView` usava essas props só pra passar adiante (e não em outro lugar da própria página), remover a leitura delas lá também.

- [ ] **Step 4: Atualizar a página que busca o doc e renderiza `EIView`**

No arquivo encontrado no Step 1 (a rota de Estruturas Iniciais), trocar a leitura de `doc.ei_data as EIData` por `(doc.ei_data as { blocks?: PartialBlock[] })?.blocks ?? null`, e passar isso como `initialBlocks` pro `EIView`. Se a página também usava `emptyEI()` como fallback pra "Modelo" sem conteúdo, trocar por `null` (o `EIBlockEditor` já trata `null`/array vazio criando um parágrafo em branco).

- [ ] **Step 5: Apagar os componentes antigos**

```bash
rm src/components/admin/ei-editor.tsx src/components/admin/ei-document.tsx
```

- [ ] **Step 6: Rodar typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: nenhum erro. Se aparecer "Cannot find module './ei-editor'" ou similar, algum import não foi pego pelo grep do Step 1 — buscar de novo e corrigir.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: hub de EI usa o editor de blocos — remove formulário de campos fixos e o toggle Documento/Editar"
```

---

### Task 5: Trocar exportação Markdown e limpar `ei-template.ts`

**Files:**
- Modify: `src/lib/ei-template.ts`
- Modify: onde hoje existem os botões "Copiar MD" / "Baixar .md" (eram parte de `ei-editor.tsx`, apagado na Task 4 — decidir nesta task se esses botões voltam no `EIBlockEditor` ou se ficam de fora por ora)

**Interfaces:**
- Consumes: `editor.document` já disponível dentro de `EIBlockEditor` (Task 2).
- Produces: `src/lib/ei-template.ts` só com o que ainda for usado por outro código (rodar grep antes de decidir o que sobra).

- [ ] **Step 1: Confirmar o que de `ei-template.ts` ainda tem uso fora dele mesmo**

Run: `grep -rn "from \"@/lib/ei-template\"\|from \"\\.\\/ei-template\"\|from \"\\.\\./\\.\\./lib/ei-template\"" src`
Expected: depois da Task 4 (que já removeu `ei-editor.tsx`/`ei-document.tsx`, os dois maiores consumidores), a lista deve encolher bastante. Qualquer arquivo restante que só importa o *tipo* `EIData` (não `emptyEI`/`renderEIMarkdown`) precisa ser ajustado pro novo shape de blocos — geralmente basta trocar `EIData` por `{ blocks: PartialBlock[] }` ou remover o import se não for mais necessário.

- [ ] **Step 2: Apagar o que sobrou de específico do formulário antigo**

Em `src/lib/ei-template.ts`, remover `EIData`, `EISecao`, `emptyEI`, `emptySecao`, `REFERENCIAS_PADRAO` e `renderEIMarkdown` — nenhum sobrevive à troca de formato (confirmado pelo grep do Step 1 de que só `ei-editor.tsx`/`ei-document.tsx`, já apagados, os usavam de fato). Se o arquivo ficar vazio, apagar o arquivo inteiro e remover qualquer import remanescente.

- [ ] **Step 3: Adicionar exportação Markdown no `EIBlockEditor` (opcional nesta rodada, mas barato)**

No `EIBlockEditor` (Task 2/3), adicionar um botão que usa a API nativa do BlockNote:

```tsx
async function copyMarkdown() {
  const markdown = await editor.blocksToMarkdownLossy(editor.document);
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(markdown);
  }
}
```

Colocar um `<button type="button" onClick={copyMarkdown}>Copiar MD</button>` no header do componente, ao lado do indicador de "Salvo em". Estilizar com as mesmas classes Tailwind que os outros botões pequenos do admin usam (ver `src/components/ui/button.tsx` pra reaproveitar o componente `Button` existente em vez de um `<button>` cru).

- [ ] **Step 4: Rodar typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove template de campos fixos da EI; exportação Markdown usa a API nativa do BlockNote"
```

---

### Task 6: Resetar as 2 linhas existentes de `ei_documents` pro novo shape

**Files:**
- Nenhum arquivo de código — só uma query SQL rodada via MCP do Supabase (mesmo fluxo usado pra aplicar a migration de status nesta sessão).

**Interfaces:**
- Consumes: nada.
- Produces: as 2 linhas de `ei_documents` (o "Modelo" e o 1 cliente com doc) passam a ter `ei_data = '{"blocks": []}'::jsonb` no lugar do shape antigo (`EIData` vazio).

- [ ] **Step 1: Conferir de novo que nenhuma das 2 linhas tem conteúdo real antes de sobrescrever**

Rodar via `execute_sql` (projeto `hwsiukyxkhvmtkbqlerx`):

```sql
select id, client_id, is_template, ei_data from public.ei_documents;
```

Expected: mesmo resultado confirmado nesta sessão (2 linhas, nenhuma com texto real preenchido nos campos de `secoes`/`copyExterno`/etc — só o shape default vazio). Se QUALQUER campo tiver texto real, parar e perguntar ao usuário antes de sobrescrever (não é o esperado, mas não assumir sem checar de novo — dados podem ter mudado desde a última verificação).

- [ ] **Step 2: Resetar pro shape novo**

```sql
update public.ei_documents set ei_data = '{"blocks": []}'::jsonb;
```

- [ ] **Step 3: Conferir**

```sql
select id, ei_data from public.ei_documents;
```

Expected: as 2 linhas com `ei_data = {"blocks": []}`.

---

### Task 7: Verificação final

**Files:** nenhum (task de verificação, sem mudança de código).

- [ ] **Step 1: Typecheck + build completos**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos passam sem erro.

- [ ] **Step 2: Verificação visual**

Se houver `.env` real disponível (este checkout não tinha um — ver nota na memória do projeto sobre a rodada de status): logar no admin, abrir `/admin/estruturas-iniciais`, abrir o "Modelo", confirmar que o editor de blocos aparece vazio, editável, com o tema Fysi (fundo branco, texto `#042B30`, seleção em mint `#BFEDE0`). Digitar um título e um parágrafo, esperar ~1s, recarregar a página e confirmar que o conteúdo persistiu (autosave funcionou). Testar o menu "/" pra inserir um bloco de imagem/lista, confirmar que arrasta pra reordenar.

Se não houver `.env` real disponível nesta máquina: documentar isso explicitamente pro usuário em vez de declarar "testado" — mesma situação da rodada de status desta sessão.

---

## Self-Review

**Spec coverage:** BlockNote + shadcn (não Mantine) ✓ Task 1/3. Tema Fysi ✓ Task 3. `ei_data` vira `{ blocks }` sem migration de schema ✓ Task 4/6. `EIDocument` eliminado, `EIView` sem toggle ✓ Task 4. `updateEIDocumentAction` genérico reaproveitado ✓ Task 4. Exportação Markdown via BlockNote nativo ✓ Task 5. Importação do ClickUp — explicitamente fora deste plano (bloqueada, ver spec) ✓ não incluída aqui de propósito.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — a única incerteza documentada (caminho exato da página de Estruturas Iniciais, export exato de `Theme`) vem com o comando `grep`/o que fazer com o resultado, não um placeholder vago.

**Type consistency:** `EIBlockEditorProps` definido na Task 2 (`docId`, `urlKey`, `initialBlocks: PartialBlock[] | null`, `atualizadoAt`) é o mesmo shape usado por `EIView` na Task 4 e pela leitura de `doc.ei_data` também na Task 4.
