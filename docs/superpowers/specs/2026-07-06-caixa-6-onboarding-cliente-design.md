# Caixa 6 — Onboarding + Painel do Cliente melhorados

> Design doc. NÃO é implementação — descreve o que construir e em que ordem. Aterrado no código atual do `briefing_app` (Next.js 16 App Router, React 19, Supabase, Tailwind 4).

---

## 1. Problema e estado atual

O lado do cliente funciona, mas tem três dores concretas, todas visíveis no código.

### 1.1 O `dashboard/page.tsx` é um monólito de 1004 linhas
`src/app/dashboard/page.tsx` é um único Client Component com:
- **17 `useState`** (linhas 26–47) alimentados por um `useEffect` de ~115 linhas (49–164) que faz o fetch de `/api/me/stage` e despacha os campos um a um.
- **Dois branches de render quase duplicados**: o "sem `projectInfo`" (linhas 203–385) e o "com `projectInfo`" (405–728). Contrato pendente (253–285 vs 457–489), próximos passos (288–324 vs 494–569), `MeusMateriaisCard`, `PaymentCard`, contrato assinado e Drive aparecem **copiados** nos dois. Qualquer ajuste precisa ser feito em dois lugares.
- **5 componentes inline** no mesmo arquivo: `CopyableValue` (733), `PhaseCard` (775), `PhaseArrow` (864), `PaymentCard` (889), `formatBRL` (994) — não reaproveitáveis fora do dashboard.

### 1.2 O link do Drive é confuso e incompleto
- O painel só expõe `fysiDriveLink` (a pasta que a Fysi cria). Aparece em **três lugares** com copy diferente: botão no header (219–228 e 423–432) e card na coluna direita (699–715).
- A migration `20260525120000_add_drive_links.sql` já criou **`cliente_drive_link`** (pasta do próprio cliente) — mas `/api/me/stage` **não retorna** esse campo (ver `select` em `src/app/api/me/stage/route.ts`) e **nada no painel o mostra**. O cliente não tem onde ver/confirmar a pasta que ele mesmo mandou.
- Existe `google_drive_folders` (jsonb `{ rootId, rootUrl, subfolders }`, migration `20260530000000`), com deep-link possível por subpasta (`06-Materiais do cliente`), mas o painel só usa o link raiz.

### 1.3 Briefing e envio de arquivos pouco visíveis
- `MeusMateriaisCard` (`src/components/meus-materiais-card.tsx`) só mostra **contagem por categoria** — sem nomes, sem thumbnail, sem link pro arquivo. O cliente não consegue conferir *o que exatamente* mandou.
- Os **links colados** no bloco de materiais (`bloco-materiais.tsx`: `logo-link`, `imagens-link`, etc.) são salvos como campos do briefing (`useBriefingField`) e **nunca reaparecem** de forma estruturada — nem no painel nem no card de materiais.
- `FileUpload` (`src/components/ui/file-upload.tsx`) faz upload imediato pra `/api/upload`, mas o botão "remover" (linha 180) só tira do estado local `value` — **não deleta do Storage nem de `briefing_files`**. Some da tela, fica no banco.
- A timeline (`ProjectTimeline`, alimentada por `buildTimeline(projectType, serverStageIndex)`) vive numa coluna espremida (571) e não conversa visualmente com o card "Próximos passos" logo acima (que é a *ação*, enquanto a timeline é o *macro*).

---

## 2. Objetivo e escopo

**Objetivo:** deixar o painel do cliente mais claro em três eixos — (a) Drive, (b) briefing/arquivos, (c) leitura do dashboard/timeline — e, no caminho, quebrar o monólito em componentes testáveis.

### Entra (escopo)
1. **Decomposição do `dashboard/page.tsx`** em: um hook de dados, componentes de seção reutilizados pelos dois branches, e uma página fina que orquestra.
2. **Seção "Drive do projeto" única e clara**, mostrando pasta da Fysi *e* pasta do cliente (`cliente_drive_link`), com deep-link opcional pra subpasta de materiais.
3. **`MeusMateriaisCard` melhorado**: lista de arquivos por categoria (nome + tamanho + link pro `public_url`) e os **links colados** do briefing, unificados numa visão só.
4. **Timeline mais legível**: header com fase atual destacada e conexão visual com "Próximos passos".
5. **Expor `cliente_drive_link`** (e deep-links de subpasta) em `/api/me/stage`.

### Fica de fora (YAGNI)
- **Deletar arquivos pelo painel do cliente.** Risco de segurança (endpoint sem auth sensível hoje, ver `me/files/route.ts`) e baixo valor. Remoção continua só *antes* do upload finalizar, no `FileUpload`.
- **Novo schema pesado.** Nenhuma tabela nova; no máximo expor colunas que já existem (§4).
- **Reescrever `buildTimeline` / tipos de projeto.** Só melhora a apresentação.
- **Upload direto pro Google Drive pelo cliente.** Continua Supabase Storage → sync server-side (fluxo do `/api/upload` intacto).
- **Auth/RLS nos endpoints `me/*`.** Mantém o padrão atual (clientId UUID de alta entropia, sem PII na resposta) — mudar isso é outra caixa.

---

## 3. Design proposto

### 3.1 Arquitetura da decomposição

Hoje: 1 arquivo, 1004 linhas, 2 branches duplicados.
Proposto: página fina + hook + componentes de seção. Um **único** caminho de render que degrada conforme os dados disponíveis (o branch "sem `projectInfo`" vira condicional *dentro* das seções, não um clone do JSX inteiro).

```
src/app/dashboard/page.tsx        (fino: usa o hook, monta o layout, delega às seções)
src/lib/use-dashboard-data.ts     (hook: encapsula loadCliente + /api/me/stage + pullResponsesFromServer)
src/components/dashboard/
  ├─ dashboard-header.tsx         (saudação + pill do tipo + botão Sair)
  ├─ next-steps.tsx               (PhaseCard/PhaseArrow + lógica dos 3 passos)
  ├─ phase-card.tsx               (extraído de page.tsx:775)
  ├─ contrato-alerta.tsx          (bloco "Atenção · contrato e pagamento", 253/457)
  ├─ payment-card.tsx             (extraído de page.tsx:889)
  ├─ drive-section.tsx            (NOVO — §3.2)
  ├─ timeline-panel.tsx           (wrapper da ProjectTimeline + header melhorado, §3.4)
  └─ briefing-status.tsx          (o "Status do briefing", 587–662)
src/components/ui/copyable-value.tsx   (extraído de page.tsx:733; usado por payment/drive)
```

Regras da refatoração:
- **Comportamento idêntico ao atual** — é refactor de estrutura, não de UX (a UX nova entra via os componentes novos das §3.2–3.4). Facilita revisar o diff.
- O branch "cliente sem `project_type`" deixa de ser um clone: `NextSteps`, `TimelinePanel` e `BriefingStatus` recebem os dados e renderizam o *fallback* internamente (ex.: `TimelinePanel` mostra o aviso "equipe ainda definindo o tipo" quando `etapas.length === 0`).

### 3.2 Seção "Drive do projeto" (nova)
`drive-section.tsx` — **um** lugar canônico, substituindo os 3 pontos espalhados.

Estados:
- **Pasta da Fysi** (`fysiDriveLink`): botão primário "Abrir pasta do projeto no Drive". Se `google_drive_folders.subfolders["06-Materiais do cliente"]` existir, oferece link secundário direto "Ver meus materiais no Drive" (`https://drive.google.com/drive/folders/{id}`), com fallback pro raiz.
- **Pasta do cliente** (`cliente_drive_link`, novo no payload): se preenchida, mostra "Sua pasta de referência: [link]" (confirma pra ele que recebemos). Se vazia, um CTA leve "Tem tudo guardado no seu Drive? Cole o link" que abre `/briefing/materiais` (ou um campo inline — ver §5).
- **Nenhum dos dois**: card explicativo "Assim que a Fysi criar a pasta do projeto, ela aparece aqui" (estado que hoje simplesmente não renderiza nada).

O botão do header (page.tsx:219/423) passa a ser um atalho que faz scroll/aponta pra essa seção — não uma cópia de lógica.

### 3.3 `MeusMateriaisCard` melhorado
Mantém o fetch de `/api/me/files` e o agrupamento por `categorizeFile` (já existe em `file-categories.ts`), mas:
- Cada categoria com arquivos **expande** (via `<details>` como no `bloco-materiais.tsx`) numa lista `nome · tamanho · abrir`, onde "abrir" é `<a href={public_url} target="_blank">`.
- Nova sub-seção **"Links que você compartilhou"**: lê os campos `*-link` das respostas do briefing (já disponíveis via `getAllResponses()` no dashboard; passar como prop `sharedLinks` pro card) e lista cada URL clicável, agrupada pela mesma categoria. Isso resgata dados que hoje ficam invisíveis (§1.3).
- Contagem total passa a somar arquivos + links.

Fonte de dados dos links: o dashboard já tem `responses` (page.tsx:28,67). Deriva-se um `Record<FileCategory, string[]>` parseando as chaves `materiais.<slug>-link` (split por linha, filtra URLs). Sem ida ao servidor.

### 3.4 Timeline mais legível
`timeline-panel.tsx`:
- Header com **"Fase atual: {etapas[serverStageIndex].titulo}"** em destaque (hoje o header só diz "X etapas · duração", page.tsx:576).
- Mesma `ProjectTimeline` por baixo (sem tocar em `buildTimeline`).
- Quando `etapas.length === 0` (sem tipo definido), renderiza o aviso amigável que hoje é JSX solto no branch (327–334).

### 3.5 Fluxo de dados (inalterado no backbone)
```
loadCliente() [localStorage]
      │
      ▼
useDashboardData(clientId)
      ├─ POST /api/me/stage  → stage, projectType, contrato*, pagamento*,
      │                         fysiDriveLink, (NOVO) clienteDriveLink,
      │                         (NOVO) driveMateriaisUrl, entrega*
      ├─ pullResponsesFromServer(clientId) → getAllResponses()
      └─ POST /api/me/files (dentro do MeusMateriaisCard) → briefing_files
```
Nenhuma mudança em `/api/upload`, `briefing/save`, `briefing/submit`.

---

## 4. Mudanças de dados

**Regra geral: Caixa 6 não exige migration.** Todas as colunas necessárias já existem.

- `clients.cliente_drive_link` — **já existe** (`20260525120000_add_drive_links.sql`). Só precisa ser **incluída no `select` e na resposta** de `src/app/api/me/stage/route.ts`.
- `clients.google_drive_folders` (jsonb) — **já existe** (`20260530000000`). O deep-link da subpasta de materiais é derivado de `subfolders["06-Materiais do cliente"]` no server; expor como `driveMateriaisUrl` no payload.
- `briefing_files` — **sem alteração**. Categoria continua derivada em runtime por `categorizeFile()` (não denormalizar — YAGNI).

**Esboço da (única) mudança de API, sem SQL:**
```ts
// me/stage/route.ts — acrescentar ao select existente:
//   "cliente_drive_link, google_drive_folders"
// e ao JSON de resposta:
clienteDriveLink: data.cliente_drive_link ?? null,
driveMateriaisUrl: subfolderUrl(data.google_drive_folders, "06-Materiais do cliente"),
// subfolderUrl(): pega subfolders[nome] → `https://drive.google.com/drive/folders/${id}`, senão null
```

> Se o time decidir que o cliente pode colar `cliente_drive_link` pelo painel (ver §5/open question), aí sim entra um endpoint de escrita — mas isso é opcional e pode reusar `/api/cliente/*` existente.

---

## 5. Rotas / API e telas de UI

### API
| Rota | Método | Mudança |
|---|---|---|
| `/api/me/stage` | POST | **Editar**: adicionar `cliente_drive_link` + `google_drive_folders` ao select; retornar `clienteDriveLink` e `driveMateriaisUrl`. |
| `/api/me/files` | POST | **Sem mudança** (já retorna `public_url`, usado pela lista nova). |
| `/api/cliente/drive-link` | POST | **Opcional/condicional** (só se aprovarmos edição pelo cliente): grava `cliente_drive_link`. Segue padrão de `/api/cliente/contrato`. |

### Telas (todas em `/dashboard`, sem rota nova)
1. **Header** (`DashboardHeader`): saudação + `Pill` do tipo + "Sair". Botão Drive vira atalho pra §2.
2. **Alerta contrato/pagamento** (`ContratoAlerta`): igual ao atual, componentizado.
3. **Próximos passos** (`NextSteps` + `PhaseCard`): igual, componentizado.
4. **Drive do projeto** (`DriveSection`): nova, §3.2.
5. **Timeline** (`TimelinePanel`): header com fase atual, §3.4.
6. **Status do briefing** (`BriefingStatus`): igual, componentizado.
7. **Meus materiais** (`MeusMateriaisCard`): arquivos expandíveis + links compartilhados, §3.3.
8. **Pagamento** (`PaymentCard`) / **Contrato assinado** / **Suporte**: componentizados.

Ordem de leitura mantém a hierarquia atual (entrega finalizada > alerta > passos > conteúdo).

---

## 6. Dependências de outras caixas

- **Nenhuma dependência dura.** A caixa é auto-contida: usa colunas e endpoints já existentes.
- Toca em superfícies compartilhadas com outras caixas (bom coordenar merge, não bloqueia):
  - **Admin/Drive**: quem preenche `cliente_drive_link` e `fysi_drive_link` é o admin (`/api/admin/*`, `admin/[id]`). Esta caixa só *lê*.
  - **Entrega**: `EntregaViewer` continua no topo do painel; a decomposição não mexe nele, só o mantém como seção.
  - **Briefing**: os links `*-link` vêm do `bloco-materiais.tsx`; se aquele bloco mudar os `field_id`, o parser de `sharedLinks` (§3.3) precisa acompanhar.

---

## 7. Riscos e decisões em aberto

**Riscos**
- **Regressão na decomposição.** O maior risco é quebrar comportamento ao eliminar o branch duplicado. Mitigação: extrair componentes 1:1 primeiro (comportamento idêntico), só depois unificar os branches; testar os dois estados (com e sem `project_type`).
- **Deep-link de subpasta 403.** `google_drive_folders.subfolders` guarda só `id`, não `webViewLink` — e a subpasta pode não estar compartilhada por link. Mitigação: `driveMateriaisUrl` é *secundário*; o botão principal usa `fysiDriveLink` (raiz, com `webViewLink` válido). Ver open question.
- **`sharedLinks` sujos.** Campos de link são textarea livre (várias linhas, texto que não é URL). Parser precisa ser tolerante: split por linha, `trim`, exibir só o que parece URL (`http(s)://`), senão ignorar.
- **Exposição de dados.** Nada novo sensível: `cliente_drive_link` é do próprio cliente e o endpoint já é gated por UUID. Mantém a postura atual.

**Decisões em aberto** — ver `openQuestions`. Nenhuma bloqueia o núcleo (decomposição + Drive + materiais); todas têm fallback seguro.

---

## 8. Ordem de implementação (incremental e testável)

Cada passo é um PR pequeno, verificável isoladamente.

1. **Extrair `CopyableValue`, `formatBRL`** pra `ui/` — reuso trivial, zero mudança de UX. *Teste: painel renderiza igual.*
2. **Extrair `PhaseCard` + `PhaseArrow`** pra `components/dashboard/phase-card.tsx`. *Teste: 3 passos idênticos.*
3. **Extrair `PaymentCard`, `ContratoAlerta`, `BriefingStatus`, `DashboardHeader`** como componentes puros (props in, JSX out). *Teste: os dois branches ainda batem.*
4. **Criar `useDashboardData` hook** movendo o `useEffect` gigante (49–164) e os 17 estados pra lá; a página passa a consumir um objeto tipado. *Teste: mesmos dados chegam à tela.*
5. **Unificar os dois branches de render** usando os componentes dos passos 1–4; o caso "sem `project_type`" vira condicional dentro de `TimelinePanel`/`NextSteps`. *Teste: alternar `project_type` no banco e ver os dois estados corretos, sem duplicação de JSX.*
6. **Editar `/api/me/stage`**: expor `clienteDriveLink` + `driveMateriaisUrl`. *Teste: curl do endpoint retorna os campos novos.*
7. **`DriveSection` nova** consumindo os campos do passo 6; header aponta pra ela. *Teste: cliente com só Fysi, só cliente, ambos, nenhum.*
8. **`TimelinePanel` com fase atual** no header. *Teste: `serverStageIndex` diferente muda o destaque.*
9. **`MeusMateriaisCard` melhorado**: arquivos expandíveis + `sharedLinks` do briefing. *Teste: cliente com arquivos e com links colados; total soma os dois.*
10. **Passada de polish/responsividade** (mobile: seções empilham; sem scroll horizontal) e limpeza de imports mortos no `page.tsx`.

Ao fim, `dashboard/page.tsx` deve cair de ~1004 pra ~150 linhas de orquestração, com o resto em componentes e um hook — cada peça testável sozinha.