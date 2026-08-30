# Estruturas Iniciais (EI) — Hub de documentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a EI (Estrutura Inicial) embutida na ficha de cada cliente por uma área central "Estruturas Iniciais" (hub) que lista todos os documentos — incluindo um "Modelo" sem cliente associado — navegáveis como páginas, com edição inline autosave e "duplicar do Modelo" ao criar um documento novo.

**Architecture:** Tabela nova `ei_documents` (uma linha por documento; `client_id` nullable — o Modelo é a linha com `client_id = null`), desacoplada de `clients`. Reaproveita os componentes de UI que já existem para o formato "documento" (`EIView`/`EIDocument`/`EIEditor`, de julho/2026) — eles já têm o toggle "Documento"/"Editar" com o visual certo; só trocam de eixo (de `clientId` pra `docId`) e o modo Editar troca botão "Salvar" por autosave em `onBlur`. Nova rota `/admin/estruturas-iniciais/[docId]` monta `AdminShell` + sidebar de documentos + o par `EIView`. A aba "EI" da ficha do cliente vira um link pra lá.

**Tech Stack:** Next.js 16 App Router (server actions, `force-dynamic`), React 19, Supabase Postgres (client `service-role`, sem RLS pública), Tailwind 4, TypeScript estrito.

**Spec:** `docs/superpowers/specs/2026-08-30-estruturas-iniciais-hub-design.md`

## Global Constraints

- **Sem framework de testes no repo** — verificação manual (`npx tsc --noEmit`, app rodando com `npm run dev`, consulta SQL), mesma convenção já usada em outros planos deste repo (ex: `docs/superpowers/plans/2026-08-29-tarefas-por-projeto.md`).
- Toda migration é **idempotente** (`create table if not exists`, `create index if not exists`, `drop trigger if exists` antes de recriar, `insert ... where not exists`).
- Toda tabela nova tem RLS habilitada **sem policy pública** — só `service-role` lê/escreve. Mesmo padrão de `project_tasks`/`admin_notifications`.
- Toda server action segue o padrão de `src/app/admin/[id]/actions.ts`: `FormData` → resolve `urlKey` → `getAdminUser({ urlKey })` → `redirect("/admin/login")` se não autenticado → `createSupabaseServiceRoleClient()` → `revalidatePath(...)`.
- Reaproveitar componentes existentes sem reescrever visual que já está certo: `EIDocument` (`src/components/admin/ei-document.tsx`) não muda; `EIView`/`EIEditor` só trocam o eixo cliente→documento e o gatilho de salvar.
- Cores/classes seguem os tokens Tailwind já definidos (`fysi-deep`, `fysi-cream`, `fysi-mint`, `fysi-line`, `fysi-muted`) — não introduzir cor nova.
- `clients.ei_data`/`clients.ei_atualizado_at` continuam existindo (não são apagados nesta rodada) — só deixam de ser lidos pelo app.

---

### Task 1: Migration `ei_documents`

**Files:**
- Create: `supabase/migrations/20260830130000_add_ei_documents.sql`

**Interfaces:**
- Consumes: `public.touch_updated_at()` (já existe), `public.clients(id)`.
- Produces: tabela `public.ei_documents` com colunas `id, client_id, nome, is_template, ei_data, created_at, updated_at` — usada pelas Tasks 3-6.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- ei_documents — hub de "Estruturas Iniciais" (EI): um documento por
-- cliente + um Modelo fixo sem cliente associado (client_id null).
-- Substitui clients.ei_data como fonte de verdade (a coluna antiga
-- continua existindo, só deixa de ser lida pelo app).
-- Ver docs/superpowers/specs/2026-08-30-estruturas-iniciais-hub-design.md
-- ============================================================
create table if not exists public.ei_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,

  nome text,
  is_template boolean not null default false,
  ei_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- no máximo 1 documento por cliente
create unique index if not exists ei_documents_client_unique
  on public.ei_documents(client_id) where client_id is not null;

-- no máximo 1 Modelo
create unique index if not exists ei_documents_one_template
  on public.ei_documents(is_template) where is_template;

drop trigger if exists ei_documents_touch_updated_at on public.ei_documents;
create trigger ei_documents_touch_updated_at
  before update on public.ei_documents
  for each row execute function public.touch_updated_at();

alter table public.ei_documents enable row level security;

comment on table public.ei_documents is
  'Hub de Estruturas Iniciais (EI) — um documento por cliente + o Modelo (client_id null).';

-- Semeia o Modelo, se ainda não existir.
insert into public.ei_documents (nome, is_template, ei_data)
select 'Modelo', true, '{}'::jsonb
where not exists (select 1 from public.ei_documents where is_template);

-- Backfill idempotente: qualquer clients.ei_data já preenchido vira uma
-- linha aqui (hoje é um no-op — 0 de 35 clientes têm ei_data preenchido).
insert into public.ei_documents (client_id, ei_data, created_at, updated_at)
select c.id, c.ei_data,
  coalesce(c.ei_atualizado_at, now()),
  coalesce(c.ei_atualizado_at, now())
from public.clients c
where c.ei_data is not null
  and not exists (
    select 1 from public.ei_documents d where d.client_id = c.id
  );
```

- [ ] **Step 2: Verificar manualmente**

Via MCP do Supabase (`execute_sql` no projeto `hwsiukyxkhvmtkbqlerx`) ou SQL Editor: rodar o arquivo e confirmar:
```sql
select id, client_id, nome, is_template from public.ei_documents;
```
Deve retornar exatamente 1 linha (`is_template = true`, `nome = 'Modelo'`, `client_id = null`) — já que hoje nenhum cliente tem `ei_data` preenchido.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260830130000_add_ei_documents.sql
git commit -m "feat(ei): migration da tabela ei_documents + seed do Modelo"
```

---

### Task 2: Tipos compartilhados (`ei-documents.ts`)

**Files:**
- Create: `src/lib/ei-documents.ts`

**Interfaces:**
- Consumes: `EIData` de `./ei-template` (já existe, não muda).
- Produces: `EIDocumentClientInfo`, `EIDocumentSummary`, `EIDocument`, `eiDocumentTitle(...)` — usados pelas Tasks 3, 4, 6, 7, 8, 9.

Client-safe (sem import de Supabase/server) — mesmo padrão de `custom-questions.ts`/`project-tasks.ts`.

- [ ] **Step 1: Criar o arquivo**

```ts
// src/lib/ei-documents.ts
import type { EIData } from "./ei-template";

/**
 * Um documento do hub de Estruturas Iniciais: ou é o Modelo
 * (isTemplate = true, clientId = null), ou é a EI de um cliente
 * (clientId setado). Ver docs/superpowers/specs/
 * 2026-08-30-estruturas-iniciais-hub-design.md
 */

export interface EIDocumentClientInfo {
  id: string;
  nome: string | null;
  empresa: string | null;
  /** Drive da Fysi ou do cliente, usado como fallback quando a EI ainda não tem link próprio (ver EIDocument). */
  fysiDriveLink: string | null;
  clienteDriveLink: string | null;
}

/** Linha resumida — usada na sidebar do hub (lista de documentos). */
export interface EIDocumentSummary {
  id: string;
  title: string;
  isTemplate: boolean;
  clientId: string | null;
  updatedAt: string;
}

/** Documento completo — usado no painel do hub e no editor. */
export interface EIDocument {
  id: string;
  clientId: string | null;
  isTemplate: boolean;
  nome: string | null;
  eiData: EIData;
  createdAt: string;
  updatedAt: string;
  client: EIDocumentClientInfo | null;
}

/**
 * Título exibido: "Modelo" pro documento-modelo, empresa/nome do cliente
 * pros demais (derivado ao vivo do cliente — evita título desatualizado
 * se o cliente for renomeado depois).
 */
export function eiDocumentTitle(doc: {
  isTemplate: boolean;
  nome: string | null;
  client: EIDocumentClientInfo | null;
}): string {
  if (doc.isTemplate) return "Modelo";
  if (doc.client) return doc.client.empresa || doc.client.nome || "Sem título";
  return doc.nome || "Sem título";
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos (arquivo ainda não é importado por ninguém).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ei-documents.ts
git commit -m "feat(ei): tipos compartilhados de ei_documents"
```

---

### Task 3: Data layer server-only (`ei-documents-server.ts`)

**Files:**
- Create: `src/lib/ei-documents-server.ts`

**Interfaces:**
- Consumes: `EIDocument`, `EIDocumentSummary`, `eiDocumentTitle` de `@/lib/ei-documents` (Task 2); `emptyEI` de `@/lib/ei-template` (já existe); `createSupabaseServiceRoleClient` de `@/lib/supabase/server`; tabela `ei_documents` (Task 1).
- Produces: `listEIDocuments()`, `getEIDocument(docId)`, `getTemplateDocument()`, `getClientEIDocumentId(clientId)`, `listClientsWithoutEIDocument()` — usados pelas Tasks 4, 8, 9, 10.

- [ ] **Step 1: Criar o arquivo**

```ts
// src/lib/ei-documents-server.ts
import { createSupabaseServiceRoleClient } from "./supabase/server";
import { emptyEI, type EIData } from "./ei-template";
import {
  eiDocumentTitle,
  type EIDocument,
  type EIDocumentClientInfo,
  type EIDocumentSummary,
} from "./ei-documents";

interface RawRow {
  id: string;
  client_id: string | null;
  nome: string | null;
  is_template: boolean;
  ei_data: EIData | null;
  created_at: string;
  updated_at: string;
  clients: {
    id: string;
    nome: string | null;
    empresa: string | null;
    fysi_drive_link: string | null;
    cliente_drive_link: string | null;
  } | null;
}

function clientInfo(row: RawRow): EIDocumentClientInfo | null {
  if (!row.clients) return null;
  return {
    id: row.clients.id,
    nome: row.clients.nome,
    empresa: row.clients.empresa,
    fysiDriveLink: row.clients.fysi_drive_link,
    clienteDriveLink: row.clients.cliente_drive_link,
  };
}

function normalize(row: RawRow): EIDocument {
  return {
    id: row.id,
    clientId: row.client_id,
    isTemplate: row.is_template,
    nome: row.nome,
    eiData: row.ei_data ?? emptyEI(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client: clientInfo(row),
  };
}

const CLIENT_COLS = "id, nome, empresa, fysi_drive_link, cliente_drive_link";
const SELECT_FULL = `id, client_id, nome, is_template, ei_data, created_at, updated_at, clients(${CLIENT_COLS})`;

/** Lista todos os documentos pra sidebar do hub — Modelo primeiro, depois alfabético. */
export async function listEIDocuments(): Promise<EIDocumentSummary[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(`id, client_id, nome, is_template, updated_at, clients(${CLIENT_COLS})`);

  const rows = ((data as unknown as RawRow[]) ?? []).map((r) => ({
    id: r.id,
    title: eiDocumentTitle({ isTemplate: r.is_template, nome: r.nome, client: clientInfo(r) }),
    isTemplate: r.is_template,
    clientId: r.client_id,
    updatedAt: r.updated_at,
  }));

  rows.sort((a, b) => {
    if (a.isTemplate !== b.isTemplate) return a.isTemplate ? -1 : 1;
    return a.title.localeCompare(b.title, "pt-BR");
  });

  return rows;
}

export async function getEIDocument(docId: string): Promise<EIDocument | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(SELECT_FULL)
    .eq("id", docId)
    .maybeSingle();
  if (!data) return null;
  return normalize(data as unknown as RawRow);
}

export async function getTemplateDocument(): Promise<EIDocument | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(SELECT_FULL)
    .eq("is_template", true)
    .maybeSingle();
  if (!data) return null;
  return normalize(data as unknown as RawRow);
}

export async function getClientEIDocumentId(clientId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Clientes que ainda não têm documento — pra popular o seletor de criação. */
export async function listClientsWithoutEIDocument(): Promise<
  { id: string; nome: string | null; empresa: string | null }[]
> {
  const service = createSupabaseServiceRoleClient();
  const { data: docs } = await service
    .from("ei_documents")
    .select("client_id")
    .not("client_id", "is", null);
  const usedIds = new Set(
    ((docs as { client_id: string }[]) ?? []).map((d) => d.client_id)
  );

  const { data: clients } = await service
    .from("clients")
    .select("id, nome, empresa")
    .order("empresa", { ascending: true });

  return (
    (clients as { id: string; nome: string | null; empresa: string | null }[]) ?? []
  ).filter((c) => !usedIds.has(c.id));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ei-documents-server.ts
git commit -m "feat(ei): data layer server-only de ei_documents"
```

---

### Task 4: Server actions (`estruturas-iniciais/actions.ts`)

**Files:**
- Create: `src/app/admin/estruturas-iniciais/actions.ts`

**Interfaces:**
- Consumes: `getTemplateDocument` de `@/lib/ei-documents-server` (Task 3); `emptyEI`, `EIData` de `@/lib/ei-template`; `getAdminUser` de `@/lib/admin`; `createSupabaseServiceRoleClient` de `@/lib/supabase/server`.
- Produces: `createEIDocumentAction(formData)`, `updateEIDocumentAction(formData)` — usados pelas Tasks 6, 8, 10.

- [ ] **Step 1: Criar o arquivo**

```ts
// src/app/admin/estruturas-iniciais/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTemplateDocument } from "@/lib/ei-documents-server";
import { emptyEI, type EIData } from "@/lib/ei-template";

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Cria o documento de um cliente, duplicado do Modelo. Idempotente: se o
 * cliente já tem um documento, só redireciona pra ele (evita duplicar se
 * o admin clicar duas vezes).
 */
export async function createEIDocumentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();

  const { data: existing } = await service
    .from("ei_documents")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) {
    redirect(
      `/admin/estruturas-iniciais/${(existing as { id: string }).id}${keyParam(urlKey)}`
    );
  }

  const template = await getTemplateDocument();
  const eiData: EIData = template?.eiData ?? emptyEI();

  const { data: created } = await service
    .from("ei_documents")
    .insert({ client_id: clientId, ei_data: eiData })
    .select("id")
    .single();

  revalidatePath("/admin/estruturas-iniciais");
  revalidatePath(`/admin/${clientId}`);

  redirect(
    `/admin/estruturas-iniciais/${(created as { id: string }).id}${keyParam(urlKey)}`
  );
}

/**
 * Autosave: grava o EIData inteiro de um documento (Modelo ou cliente).
 * Disparado no onBlur de cada campo do EIEditor — ver Task 6.
 */
export async function updateEIDocumentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const docId = String(formData.get("docId") ?? "");
  if (!docId) return;

  const raw = String(formData.get("eiJson") ?? "").trim();
  if (!raw) return;

  let parsed: EIData;
  try {
    parsed = JSON.parse(raw) as EIData;
  } catch {
    return;
  }

  const service = createSupabaseServiceRoleClient();
  await service
    .from("ei_documents")
    .update({ ei_data: parsed, updated_at: new Date().toISOString() })
    .eq("id", docId);

  revalidatePath(`/admin/estruturas-iniciais/${docId}`);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/estruturas-iniciais/actions.ts
git commit -m "feat(ei): server actions de criação e autosave de ei_documents"
```

---

### Task 5: Nav "Estruturas Iniciais" no `AdminShell`

**Files:**
- Modify: `src/components/admin/admin-shell.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: `AdminSection` passa a incluir `"estruturas-iniciais"` — usado pela Task 9 (`active="estruturas-iniciais"` na página do hub).

- [ ] **Step 1: Adicionar ao tipo `AdminSection`**

Mudar (linha 13-21):

```ts
export type AdminSection =
  | "clientes"
  | "lista"
  | "briefings"
  | "quadro"
  | "conteudo"
  | "contratos"
  | "cobrancas"
  | "relatorios";
```

para:

```ts
export type AdminSection =
  | "clientes"
  | "lista"
  | "briefings"
  | "quadro"
  | "estruturas-iniciais"
  | "conteudo"
  | "contratos"
  | "cobrancas"
  | "relatorios";
```

- [ ] **Step 2: Adicionar o ícone em `ICONS`**

Logo depois da entrada `quadro` (por volta da linha 79), adicionar:

```tsx
  "estruturas-iniciais": (
    <I>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </I>
  ),
```

- [ ] **Step 3: Adicionar o item em `AREAS` (área "Projetos")**

Mudar (linhas 120-129):

```ts
  {
    label: "Projetos",
    items: [
      item("clientes", "Clientes", "/admin"),
      item("lista", "Lista por status", "/admin/lista"),
      item("briefings", "Briefings", "/admin/briefings"),
      item("quadro", "Quadro", "/admin/quadro"),
    ],
  },
```

para:

```ts
  {
    label: "Projetos",
    items: [
      item("clientes", "Clientes", "/admin"),
      item("lista", "Lista por status", "/admin/lista"),
      item("briefings", "Briefings", "/admin/briefings"),
      item("quadro", "Quadro", "/admin/quadro"),
      item("estruturas-iniciais", "Estruturas Iniciais", "/admin/estruturas-iniciais"),
    ],
  },
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros (o TypeScript vai reclamar se `ICONS`/`LABELS` — que são `Record<AdminSection, ...>` — ficarem sem a chave nova; conferir que o Step 2 cobriu isso).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-shell.tsx
git commit -m "feat(ei): item de nav Estruturas Iniciais em Projetos"
```

---

### Task 6: `EIEditor` — autosave por campo, eixo `docId`

**Files:**
- Modify: `src/components/admin/ei-editor.tsx`

**Interfaces:**
- Consumes: `updateEIDocumentAction` de `@/app/admin/estruturas-iniciais/actions` (Task 4), no lugar de `setEIAction`.
- Produces: `EIEditor` passa a aceitar `docId` no lugar de `clientId`, sem prop `clientName`/`empresa` (não precisa mais — quem mostra o título é o `EIDocument`, não o editor). Consumido pela Task 7 (`EIView`).

Esta é a maior mudança de código do plano. O arquivo já existe e tem ~460
linhas; as mudanças abaixo são cirúrgicas — trocar a prop de identidade,
trocar a action, remover o botão de salvar, e adicionar `onBlur={save}`
em cada campo (inclusive dentro de `SecaoEditor`).

- [ ] **Step 1: Trocar imports e a assinatura de `EIEditor`**

Em `src/components/admin/ei-editor.tsx`, mudar o import da action:

```ts
import { setEIAction } from "@/app/admin/[id]/actions";
```

para:

```ts
import { updateEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";
```

Mudar a assinatura da função (linhas 29-43):

```ts
export function EIEditor({
  clientId,
  clientName,
  empresa,
  urlKey,
  initial,
  atualizadoAt,
}: {
  clientId: string;
  clientName: string | null;
  empresa: string | null;
  urlKey: string | null;
  initial: EIData | null;
  atualizadoAt: string | null;
}) {
```

para:

```ts
export function EIEditor({
  docId,
  urlKey,
  initial,
  atualizadoAt,
}: {
  docId: string;
  urlKey: string | null;
  initial: EIData | null;
  atualizadoAt: string | null;
}) {
```

- [ ] **Step 2: Trocar a função `save` por autosave (sem `pending` bloqueando digitação)**

Mudar (linhas 89-107):

```ts
  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    const formData = new FormData();
    formData.append("clientId", clientId);
    if (urlKey) formData.append("key", urlKey);
    formData.append("eiJson", JSON.stringify(data));
    setSaveError(null);
    startTransition(async () => {
      try {
        await setEIAction(formData);
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
```

para:

```ts
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Autosave — chamado no onBlur de cada campo (ver §6.2 do spec). */
  function save() {
    const formData = new FormData();
    formData.append("docId", docId);
    if (urlKey) formData.append("key", urlKey);
    formData.append("eiJson", JSON.stringify(data));
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateEIDocumentAction(formData);
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
```

`data` continua sendo lido do estado do componente por closure — cada
`onBlur` dispara `save()` com o valor mais recente, porque `save` é
redefinida a cada render.

- [ ] **Step 3: Trocar o cabeçalho (remove botão "Salvar EI" do topo)**

Mudar (linhas 136-186, o `<div className="flex items-center gap-2">` de
botões do cabeçalho):

```tsx
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Editar" : "Pré-visualizar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={copyMarkdown}
          >
            Copiar MD
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={downloadMarkdown}
          >
            ⬇ .md
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar EI"}
          </Button>
        </div>
```

para:

```tsx
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Editar" : "Pré-visualizar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={copyMarkdown}
          >
            Copiar MD
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={downloadMarkdown}
          >
            ⬇ .md
          </Button>
          {pending ? (
            <span className="text-xs text-fysi-muted px-2">Salvando…</span>
          ) : null}
        </div>
```

E o indicador de "Salvo em" no bloco acima (linhas 141-150) muda a
mensagem padrão, já que não existe mais "nunca salvo pq nunca clicou":

```tsx
          {savedAt ? (
            <span>
              · Salvo em {new Date(savedAt).toLocaleString("pt-BR")}
            </span>
          ) : (
            <span className="text-amber-700">· Nunca salvo</span>
          )}
```

permanece igual — `savedAt` inicial vem de `atualizadoAt` (prop), então
"Nunca salvo" só aparece em documento realmente novo. Sem mudança aqui.

- [ ] **Step 4: Remover o bloco "Salvar duplicado embaixo" no fim do form**

Mudar (linhas 345-350):

```tsx
          {/* Salvar duplicado embaixo (UX) */}
          <div className="flex justify-end pt-2 border-t border-fysi-line">
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar EI"}
            </Button>
          </div>
```

para (remove o bloco inteiro, sobra só o fechamento do `</div>` pai que
já existia — conferir indentação ao redor de `</section>` na linha 353).

- [ ] **Step 5: Adicionar `onBlur={save}` em cada campo de nível superior**

Em cada `<Input .../>` e `<Textarea .../>` dentro do bloco `Block`
("Acesso e materiais", "Referências", "Copy do cliente", "COPY — MENU
tem?", "RODAPÉ" — não nas seções dinâmicas, essas são o Step 6), adicionar
`onBlur={save}` — por exemplo:

```tsx
            <Textarea
              label="Dados de acesso (domínio / hospedagem / WordPress)"
              value={data.dadosAcesso}
              onChange={(e) => update("dadosAcesso", e.target.value)}
              onBlur={save}
              rows={3}
              placeholder="user/senha pro WordPress, painel de hospedagem, DNS..."
            />
```

Repetir o mesmo padrão (`onBlur={save}` logo após o `onChange`) em TODOS
os campos que chamam `update(...)` no `onChange`: `briefingLink`,
`driveLink`, `logo`, `imagens`, `fonteLetra`, `cores`,
`paginasReferencia`, `referenciasGerais`, `copyExterno`, `menuTem`,
`rodape`.

- [ ] **Step 6: Adicionar autosave em `SecaoEditor`**

`SecaoEditor` não tem acesso direto a `save()` — precisa receber como
prop. Mudar a assinatura (linhas 374-388):

```ts
function SecaoEditor({
  secao,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  secao: EISecao;
  index: number;
  total: number;
  onChange: (patch: Partial<EISecao>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
```

para:

```ts
function SecaoEditor({
  secao,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onBlurSave,
}: {
  secao: EISecao;
  index: number;
  total: number;
  onChange: (patch: Partial<EISecao>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onBlurSave: () => void;
}) {
```

Adicionar `onBlur={onBlurSave}` em cada campo do corpo da função (nome
da seção, `*obs`, `Ref`, `[Título]`, `[Texto]`, `[CTA]` — linhas
393-463), por exemplo:

```tsx
      <Input
        label="[Título]"
        value={secao.titulo}
        onChange={(e) => onChange({ titulo: e.target.value })}
        onBlur={onBlurSave}
        placeholder="Título principal da seção"
      />
```

E no ponto onde `EIEditor` renderiza `<SecaoEditor .../>` (dentro do
`.map` em "COPY — estrutura de seções", por volta da linha 310-320),
passar a prop nova:

```tsx
                <SecaoEditor
                  key={i}
                  secao={s}
                  index={i}
                  total={data.secoes.length}
                  onChange={(patch) => updateSecao(i, patch)}
                  onRemove={() => removeSecao(i)}
                  onMove={(dir) => moveSecao(i, dir)}
                  onBlurSave={save}
                />
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Se aparecer erro em `ei-view.tsx` (que ainda passa
`clientId`/`clientName`/`empresa` pro `EIEditor`), é esperado — corrigido
na Task 7, próxima.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/ei-editor.tsx
git commit -m "feat(ei): EIEditor troca clientId por docId e Salvar por autosave"
```

---

### Task 7: `EIView` — eixo `docId`

**Files:**
- Modify: `src/components/admin/ei-view.tsx`

**Interfaces:**
- Consumes: `EIEditor` (Task 6, agora com prop `docId`).
- Produces: `EIView` passa a aceitar `docId` (substitui `clientId`); consumido pela Task 9 (`[docId]/page.tsx`).

- [ ] **Step 1: Trocar a assinatura e a passagem de props**

Mudar (arquivo inteiro é pequeno, 59 linhas):

```tsx
export function EIView(props: {
  clientId: string;
  clientName: string | null;
  empresa: string | null;
  urlKey: string | null;
  initial: EIData | null;
  atualizadoAt: string | null;
  fallbackDrive?: string | null;
}) {
```

para:

```tsx
export function EIView(props: {
  docId: string;
  clientName: string | null;
  empresa: string | null;
  urlKey: string | null;
  initial: EIData | null;
  atualizadoAt: string | null;
  fallbackDrive?: string | null;
}) {
```

E na chamada de `<EIEditor .../>` dentro do `mode === "edit"` (linhas
47-55):

```tsx
      ) : (
        <EIEditor
          clientId={props.clientId}
          clientName={props.clientName}
          empresa={props.empresa}
          urlKey={props.urlKey}
          initial={props.initial}
          atualizadoAt={props.atualizadoAt}
        />
      )}
```

para:

```tsx
      ) : (
        <EIEditor
          docId={props.docId}
          urlKey={props.urlKey}
          initial={props.initial}
          atualizadoAt={props.atualizadoAt}
        />
      )}
```

`clientName`/`empresa` continuam sendo passados pro `EIDocument` (modo
"doc", linhas 40-46) sem mudança — servem só pro título, não pra
identidade de salvamento.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `ei-view.tsx`/`ei-editor.tsx`. Pode
aparecer erro em `src/app/admin/[id]/page.tsx` (ainda chama `<EIView
clientId=... />`) — corrigido na Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ei-view.tsx
git commit -m "feat(ei): EIView troca clientId por docId"
```

---

### Task 8: Sidebar de documentos (`ei-document-sidebar.tsx`)

**Files:**
- Create: `src/components/admin/ei-document-sidebar.tsx`

**Interfaces:**
- Consumes: `EIDocumentSummary` de `@/lib/ei-documents` (Task 2); `createEIDocumentAction` de `@/app/admin/estruturas-iniciais/actions` (Task 4).
- Produces: `EIDocumentSidebar` — consumido pela Task 9 (`[docId]/page.tsx`).

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/admin/ei-document-sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useTransition } from "react";
import { createEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";
import type { EIDocumentSummary } from "@/lib/ei-documents";

export function EIDocumentSidebar({
  docs,
  activeId,
  urlKey,
  clientsWithoutDoc,
}: {
  docs: EIDocumentSummary[];
  activeId: string;
  urlKey: string | null;
  clientsWithoutDoc: { id: string; nome: string | null; empresa: string | null }[];
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  function createFor(clientId: string) {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await createEIDocumentAction(fd);
    });
  }

  return (
    <aside className="w-[280px] shrink-0 border-r border-fysi-line bg-white flex flex-col h-full">
      <div className="p-3 border-b border-fysi-line flex flex-col gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar documento…"
          className="w-full rounded-[8px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-1.5"
        />
        {clientsWithoutDoc.length > 0 ? (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="text-sm font-medium text-fysi-deep hover:text-fysi-green text-left"
          >
            + Nova Estrutura Inicial
          </button>
        ) : null}
        {creating ? (
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-fysi-line bg-fysi-cream/30 p-2">
            {clientsWithoutDoc.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => createFor(c.id)}
                className="text-left text-sm text-fysi-deep hover:text-fysi-green disabled:opacity-50 truncate"
              >
                {c.empresa || c.nome || "Sem nome"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {filtered.map((doc) => (
          <Link
            key={doc.id}
            href={`/admin/estruturas-iniciais/${doc.id}${kp}`}
            className={`flex items-center gap-2 px-3 py-2 text-sm truncate ${
              doc.id === activeId
                ? "bg-fysi-mint/40 text-fysi-deep font-medium"
                : "text-fysi-muted hover:bg-fysi-cream/60 hover:text-fysi-deep"
            }`}
          >
            {doc.isTemplate ? <span title="Modelo">★</span> : null}
            <span className="truncate">{doc.title}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ei-document-sidebar.tsx
git commit -m "feat(ei): sidebar de documentos do hub de Estruturas Iniciais"
```

---

### Task 9: Rotas do hub

**Files:**
- Create: `src/app/admin/estruturas-iniciais/page.tsx`
- Create: `src/app/admin/estruturas-iniciais/[docId]/page.tsx`

**Interfaces:**
- Consumes: `listEIDocuments`, `getEIDocument`, `getTemplateDocument`, `listClientsWithoutEIDocument` de `@/lib/ei-documents-server` (Task 3); `EIDocumentSidebar` (Task 8); `EIView` (Task 7); `AdminShell` (Task 5); `getAdminUser` de `@/lib/admin`.
- Produces: rotas `/admin/estruturas-iniciais` e `/admin/estruturas-iniciais/[docId]` — telas finais do hub.

- [ ] **Step 1: Criar o redirect `page.tsx`**

```tsx
// src/app/admin/estruturas-iniciais/page.tsx
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getTemplateDocument } from "@/lib/ei-documents-server";

export const dynamic = "force-dynamic";

export default async function EstruturasIniciaisIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const template = await getTemplateDocument();
  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  redirect(`/admin/estruturas-iniciais/${template?.id ?? ""}${kp}`);
}
```

- [ ] **Step 2: Criar `[docId]/page.tsx`**

```tsx
// src/app/admin/estruturas-iniciais/[docId]/page.tsx
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { EIDocumentSidebar } from "@/components/admin/ei-document-sidebar";
import { EIView } from "@/components/admin/ei-view";
import {
  listEIDocuments,
  getEIDocument,
  listClientsWithoutEIDocument,
} from "@/lib/ei-documents-server";

export const dynamic = "force-dynamic";

export default async function EIDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ docId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { docId } = await params;
  const sp = await searchParams;
  const urlKey = sp.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const [docs, doc, clientsWithoutDoc] = await Promise.all([
    listEIDocuments(),
    getEIDocument(docId),
    listClientsWithoutEIDocument(),
  ]);

  if (!doc) redirect(`/admin/estruturas-iniciais${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  return (
    <AdminShell active="estruturas-iniciais" keyParam={keyParamFirst} userEmail={user.email}>
      {/*
        AdminShell's <main> tem px-4 md:px-6 lg:px-8 py-6 — cancelamos com
        margem negativa igual pra sidebar e painel encostarem nas bordas,
        e limitamos a altura ao viewport menos a topbar (h-14 = 3.5rem).
      */}
      <div className="flex -mx-4 md:-mx-6 lg:-mx-8 -my-6 h-[calc(100vh-3.5rem)]">
        <EIDocumentSidebar
          docs={docs}
          activeId={docId}
          urlKey={urlKey}
          clientsWithoutDoc={clientsWithoutDoc}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <EIView
            docId={doc.id}
            clientName={doc.client?.nome ?? null}
            empresa={doc.isTemplate ? "Modelo" : (doc.client?.empresa ?? null)}
            urlKey={urlKey}
            initial={doc.eiData}
            atualizadoAt={doc.updatedAt}
            fallbackDrive={
              doc.client?.fysiDriveLink || doc.client?.clienteDriveLink || null
            }
          />
        </div>
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificar manualmente**

Com `npm run dev` rodando e a migration da Task 1 já aplicada:
1. Abrir `/admin/estruturas-iniciais?key=<senha>` — deve redirecionar
   pro Modelo (`/admin/estruturas-iniciais/<uuid>?key=...`).
2. A sidebar deve mostrar "★ Modelo" como único item (nenhum cliente
   tem documento ainda).
3. Clicar "+ Nova Estrutura Inicial", escolher um cliente — deve criar
   o documento (duplicado do Modelo, hoje vazio) e navegar pra ele.
4. No modo "Editar", preencher um campo (ex: Logo) e clicar fora
   (blur) — o indicador "Salvo em" deve atualizar sem precisar clicar
   em nenhum botão. Recarregar a página (F5) e confirmar que o valor
   persistiu.
5. Voltar pro Modelo pela sidebar, editar um campo lá, confirmar que
   salva separado do documento do cliente (não vaza entre os dois).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/estruturas-iniciais/page.tsx src/app/admin/estruturas-iniciais/[docId]/page.tsx
git commit -m "feat(ei): rotas do hub de Estruturas Iniciais"
```

---

### Task 10: Aba "EI" da ficha do cliente vira link-out

**Files:**
- Modify: `src/app/admin/[id]/page.tsx`

**Interfaces:**
- Consumes: `getClientEIDocumentId` de `@/lib/ei-documents-server` (Task 3); `createEIDocumentAction` de `@/app/admin/estruturas-iniciais/actions` (Task 4).
- Produces: bloco `tab === "ei"` novo — não é mais consumido por ninguém (é o fim da cadeia).

- [ ] **Step 1: Carregar o `docId` do cliente**

No `Promise.all` que já carrega `client`/`responses`/`files`/`tasks`
(por volta da linha 101-106, já modificado pelo plano de Tarefas),
adicionar mais uma consulta:

```ts
  const [{ data: client }, { data: responses }, { data: files }, tasks, eiDocId] =
    await Promise.all([
      service.from("clients").select("*").eq("id", id).maybeSingle(),
      service.from("briefing_responses").select("*").eq("client_id", id),
      service.from("briefing_files").select("*").eq("client_id", id),
      listProjectTasks(id),
      getClientEIDocumentId(id),
    ]);
```

No topo do arquivo, adicionar o import:

```ts
import { getClientEIDocumentId } from "@/lib/ei-documents-server";
```

- [ ] **Step 2: Trocar o bloco de render da aba "ei"**

Mudar (linhas 659-674):

```tsx
        {tab === "ei" ? (
        <EIView
          clientId={client.id}
          clientName={client.nome ?? null}
          empresa={client.empresa ?? null}
          urlKey={urlKey ?? null}
          initial={(client.ei_data as EIData | null) ?? null}
          atualizadoAt={client.ei_atualizado_at ?? null}
          fallbackDrive={
            (client as { fysi_drive_link?: string | null }).fysi_drive_link ??
            (client as { cliente_drive_link?: string | null })
              .cliente_drive_link ??
            null
          }
        />
        ) : null}
```

para:

```tsx
        {tab === "ei" ? (
          <section className="bg-white border border-fysi-line rounded-[20px] p-8 text-center">
            {eiDocId ? (
              <>
                <p className="text-fysi-deep font-medium">
                  Estrutura Inicial deste cliente
                </p>
                <a
                  href={`/admin/estruturas-iniciais/${eiDocId}${
                    urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""
                  }`}
                  className="inline-flex items-center gap-2 mt-4 rounded-full bg-fysi-mint border border-fysi-mint-vivid text-fysi-deep text-sm font-semibold px-4 py-2"
                >
                  Abrir Estrutura Inicial ↗
                </a>
              </>
            ) : (
              <>
                <p className="text-fysi-deep font-medium">
                  Nenhuma Estrutura Inicial ainda.
                </p>
                <form action={createEIDocumentAction}>
                  <input type="hidden" name="clientId" value={client.id} />
                  {urlKey ? (
                    <input type="hidden" name="key" value={urlKey} />
                  ) : null}
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 mt-4 rounded-full bg-fysi-mint border border-fysi-mint-vivid text-fysi-deep text-sm font-semibold px-4 py-2"
                  >
                    Criar a partir do Modelo
                  </button>
                </form>
              </>
            )}
          </section>
        ) : null}
```

No topo do arquivo, trocar os imports que só serviam pro bloco antigo —
`EIView` e o `type { EIData }` de `@/lib/ei-template` não são usados em
mais nenhum lugar deste arquivo (confirmado via grep):

```ts
import { EIView } from "@/components/admin/ei-view";
import type { EIData } from "@/lib/ei-template";
```

para:

```ts
import { createEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificar manualmente**

1. Abrir um cliente sem documento (`/admin/[id]?tab=ei&key=...`) —
   deve mostrar "Nenhuma Estrutura Inicial ainda" com o botão "Criar a
   partir do Modelo".
2. Clicar no botão — deve criar o documento e levar direto pro hub
   (`/admin/estruturas-iniciais/<uuid>`).
3. Voltar pra ficha do mesmo cliente, aba "ei" de novo — agora deve
   mostrar "Abrir Estrutura Inicial ↗" (documento já existe).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/[id]/page.tsx"
git commit -m "feat(ei): aba EI da ficha do cliente vira link pro hub"
```

---

## Self-Review Notes

- **Spec coverage:** §4 (modelo de dados) → Task 1. §5 (nav) → Task 5.
  §6.1 (layout/hub) → Tasks 8, 9. §6.2 (autosave) → Task 6. §6.3
  (criação) → Task 4, 8. Link-out da ficha do cliente (§5) → Task 10.
  §3 (fora de escopo: reorg de nav, migração do conteúdo do ClickUp,
  unificação de status) não tem task — de propósito.
- **Placeholder scan:** nenhum "TBD"/"implementar depois" — todo código
  é completo. As únicas ressalvas textuais (Task 9 Step 2, sobre o
  `-m-6` do `AdminShell`) são instruções de verificação, não código
  incompleto.
- **Reuso, não reescrita:** `EIDocument` (`ei-document.tsx`) não é
  tocado em nenhuma task — o visual "documento" já existe e já está
  certo, só o que alimenta ele (`docId` em vez de `clientId`) muda via
  `EIView` (Task 7).
- **Type consistency:** `EIDocument`/`EIDocumentSummary`/`eiDocumentTitle`
  definidos uma vez (Task 2), consumidos idênticos em Tasks 3, 8, 9.
  `docId` como nome de prop é consistente entre `EIEditor` (Task 6),
  `EIView` (Task 7), `EIDocumentSidebar` (Task 8, como `activeId`) e as
  actions (Task 4, campo `docId` no `FormData`). `createEIDocumentAction`/
  `updateEIDocumentAction` (Task 4) têm o mesmo nome e assinatura
  (`FormData`) em todo lugar que os importa (Tasks 6, 8, 10).
