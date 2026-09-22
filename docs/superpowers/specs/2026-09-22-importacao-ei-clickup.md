# Importação das Estruturas Iniciais do ClickUp — inventário e plano

> Levantamento read-only feito em 2026-09-22. **Nada foi gravado no banco nem
> alterado no ClickUp.** Este documento é o plano de execução; a importação
> em si depende das decisões da seção 8.

Pedido da Karine:

> "EI precisa puxar do ClickUp todas mesmo que depois tenhamos que arquivar,
> precisamos deixar um banco de dados salvo"

Ou seja: o objetivo não é só trazer os clientes ativos — é **constituir o
arquivo histórico**. Isso muda o desenho: uma EI sem cliente correspondente
não é um erro a corrigir, é o caso normal.

---

## 1. O modelo de dados hoje

`public.ei_documents` (migrations `20260830130000`, `20260831040000`,
`20260921091934`):

| Coluna | Tipo | Papel |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid → `clients(id)` ON DELETE CASCADE, nullable | vínculo com o cliente; `null` = documento avulso |
| `kind` | text NOT NULL default `'ei'`, CHECK in (`'ei'`,`'briefing'`) | separa Estrutura Inicial de Briefing |
| `nome` | text | título livre; só usado quando não há cliente |
| `is_template` | boolean | o "Modelo" (1 por `kind`) |
| `ei_data` | jsonb NOT NULL default `{}` | **`{"blocks": PartialBlock[]}`** — documento do BlockNote |
| `credenciais` | jsonb | cofre de acessos: `[{contexto, rotulo, valor}]`, fora do corpo |
| `clickup_page_id` | text | **chave de idempotência** da importação |
| `share_token` / `share_enabled` / `share_created_at` / `share_expires_at` | | link público (hoje só usado por briefing) |
| `origem` | text | `'clickup'` nos importados |
| `created_at` / `updated_at` | timestamptz | `updated_at` por trigger `touch_updated_at` |

**Conteúdo**: `ei_data.blocks` é um array de blocos do BlockNote
(`PartialBlock[]` de `@blocknote/core`) — `paragraph`, `heading`,
`bulletListItem`, `numberedListItem`, `checkListItem`, `divider`, `image`,
`codeBlock`. O app lê em `src/lib/ei-documents-server.ts:normalize()`, que
faz `Array.isArray(row.ei_data?.blocks) ? … : []`.

**Vínculo com cliente**: `client_id`. O título exibido é derivado ao vivo do
cliente (`eiDocumentTitle` em `src/lib/ei-documents.ts`): `empresa || nome`,
e só cai em `nome` quando não há cliente.

**`kind='ei'` vs `kind='briefing'`**: mesma tabela, dois documentos
diferentes do ciclo. A EI é a camada de **produção** (acessos, Figma, drive,
link dos botões, copy seção a seção) — ~22 blocos no Modelo. O briefing é a
camada de **descoberta** preenchida na call — ~150 blocos. Ver
`docs/superpowers/specs/2026-09-21-unificacao-ei-briefing-design.md`.

### 1.1 🚨 A constraint que bloqueia o pedido

```sql
CREATE UNIQUE INDEX ei_documents_client_ei_unique
  ON public.ei_documents (client_id)
  WHERE client_id IS NOT NULL AND kind = 'ei';
```

**Um cliente pode ter no máximo UMA Estrutura Inicial.** Briefing foi
liberado para vários por cliente na migration `20260921091934`; EI não.

No ClickUp a realidade é outra: a Sofia Rito sozinha tem **3 EIs** só no doc
de 2026 (`04/2026`, `Nova Landing Page Jul 2026`, `Setembro 2026`), mais 2 no
doc histórico. Gustavo, Karine, Bruna Puga, Board Academy, Werley, Rogério,
Jackson e outros repetem o padrão: **uma EI por projeto/página, não por
cliente**.

Importar "todas" com `client_id` preenchido viola este índice. É o primeiro
bloqueador, e ele é de schema — ver decisão D1 na seção 8.

---

## 2. Os números

### 2.1 No app (produção, Supabase `hwsiukyxkhvmtkbqlerx`)

| | `kind='ei'` | `kind='briefing'` |
|---|---|---|
| total | **2** | 35 |
| Modelo (`is_template`) | 1 | 1 |
| de cliente | 1 | 33 |
| com `clickup_page_id` | **0** | 34 |
| com `credenciais` | 0 | 1 |

A única EI de cliente é a de **Celebrar Eventos / Juliana Bravo**
(`4e0cc739-3b41-40ba-b516-991cf607a905`), com 6 blocos — menos que o Modelo
(22 blocos). É um documento **iniciado e abandonado**, não uma EI preenchida.

Em resumo: **a Estrutura Inicial no app está praticamente vazia**. Não existe
nenhuma importação anterior de EI (ao contrário do briefing, que já tem 34
páginas do ClickUp). Não há botão de sincronizar em
`/admin/estruturas-iniciais` — o único importador que existe hoje
(`importarBriefingsDoClickUp`) é fixo em `kind='briefing'` e no doc
`xj7td-41071`.

### 2.2 No ClickUp (workspace 31006509)

As EIs **não** estão num doc só. São **quatro**, todos no Space
"Produção&Gestão":

| doc_id | nome | páginas | papel |
|---|---|---|---|
| `xj7td-89891` | **EI's - 2026** (folder "Estruturas Iniciais") | **73** | corrente — é o doc do link que a Karine mandou |
| `xj7td-4043` | **Estrutura Inicial Projeto certa** | **395** | arquivo histórico, subpáginas até 3 níveis — §2.3 |
| `xj7td-34431` | **Novo Estrutura inicial** | **34** | histórico menor, bem misto — §2.3 |
| `xj7td-89291` | **EI - Valéria corrigida** (folder "Estruturas Iniciais") | **27** | doc de trabalho, com duplicatas — §2.4 |
| | **TOTAL** | **529** | |

**529 páginas** no universo total. Desse conjunto, a estimativa de EI com
conteúdo real aproveitável é de **~400** (69 em 2026 + 329 nos históricos,
mais o que houver no doc da Valéria, que não foi medido) — o resto é
modelo em branco, página vazia ou navegação de site antigo.

O link que a Karine mandou (`xj7td-89891/xj7td-146851`) é a página
`EI - Jéssica` dentro do doc corrente. Ou seja, o pedido "puxar todas"
alcança os outros três docs também — não dá para atender olhando só o link
que ela passou.

⚠️ Os quatro docs saíram de busca por palavra-chave (`clickup_search`), cuja
paginação não deu para exaurir com confiança. **Pode haver um quinto doc de
EI** que a busca não trouxe. Vale confirmar com a Karine antes de declarar o
arquivo completo — ver decisão D3.

Doc `xj7td-89891` — as 73 páginas, todas baixadas e medidas:

- **299.621 caracteres** de markdown no total (média 4.1 KB/página)
- 0 páginas vazias (<500 chars)
- 2 páginas são só o modelo em branco (1.994 chars): `EI - Modelo (copy)` e
  uma das duas `EI - Letícia Rodrigues`
- **69 páginas com conteúdo real** (>2.200 chars)
- 3 páginas não são EI de cliente: `EI - Modelo`, `EI - Modelo (copy)`,
  `EI - ORIENTAÇÕES`
- maior página: `EI - Dr. Rafael Rapozo 2026`, 20.572 chars

**Volume depois de convertido** (medido rodando `markdownToBlocks` +
`extrairCredenciais` de verdade sobre as páginas):

| | |
|---|---|
| markdown bruto | 293 KB |
| JSON de blocos (`ei_data`) | **1.812 KB** — fator 6,2× |
| blocos gerados | 9.676 (média 136/página) |
| maior documento | 90 KB (`EI - Dr. Rafael Rapozo 2026`) |

1,8 MB **só do doc de 2026** confirma a armadilha já paga na importação de
briefings: SQL desse tamanho não passa numa chamada MCP. Tem que sair um
`.sql` por página, e o JSON precisa ser minificado (ver §7, passo 3).

### 2.3 Os docs históricos `xj7td-4043` e `xj7td-34431`

Inventariados por completo (429/429 páginas baixadas e medidas):

| | `xj7td-4043` | `xj7td-34431` | total |
|---|---|---|---|
| páginas | **395** | **34** | 429 |
| de nível raiz | 264 | 31 | 295 |
| subpáginas (até 3 níveis) | 131 | 3 | 134 |
| markdown bruto | 5,74 M chars | 162 K chars | 5,90 M |
| vazias (<500) | 40 (12 com **0** chars) | 0 | 40 |
| só o modelo (500–2.200) | 48 | 12 | 60 |
| **conteúdo real (>2.200)** | **307** | **22** | **329** |

O modelo em branco do doc histórico (`xj7td-5791`) tem 1.920 chars, o que
confirma o corte em 2.200 como bem calibrado: das 329 páginas acima do
corte, **299 têm mais de 1.000 chars de conteúdo genuinamente único**
(descontando `SEÇÃO 01..13`, `[Título]`, `[Texto]`, `*obs:`, `Ref:` e o
bloco de links do Behance, que são idênticos em toda página). Só 2 das 329
ficam abaixo de 200 chars líquidos, e há um grupo intermediário de 12
páginas entre 2.200 e 2.600 chars que são o modelo mais 2–3 links.

**Boa parte não é EI.** As páginas curtas são majoritariamente navegação de
sites antigos — `Home`, `Sobre`, `Blog`, `Contatos`, `Login e cadastro`,
`SEGURO DE VIDA`, `Cirurgias Faciais`. Dez páginas não têm título nenhum
(seis delas vazias).

#### 🚨 Três páginas são quase inteiramente imagem base64

| página | bruto | texto real |
|---|---|---|
| `xj7td-68771` `EI - Luciana Mello` | 1.748.693 chars | ~6.400 |
| `xj7td-118531` `EI - James` | 1.474.157 chars | ~3.315 |
| `xj7td-121071` `EI - Vanessa Vincenzi` | 400.600 chars | ~4.446 |

98–99% do volume dessas páginas é uma imagem embutida como `data:` URI.
`markdownToBlocks` casa `RE_IMAGE` e põe a URI inteira em `props.url`, o
que significa **1,7 MB dentro de uma célula `ei_data`** — a linha fica
impossível de trafegar num `execute_sql` e o editor de blocos trava ao
abrir. Descontando esses três, o corpus real dos dois docs cai de 5,9 M
para **~2,3 M chars**.

Tratamento necessário: extrair o `data:` URI para o Storage (o app já tem
`src/lib/storage.ts` e `downscale-image.ts`) e guardar só a URL — ou, para
um arquivo histórico, descartar a imagem e deixar o texto. Decisão D3.

#### Duplicação: 58% das páginas são repetição do mesmo cliente

**80 "famílias" de cliente somam 247 das 429 páginas.** Não é um registro
1:1 — é o histórico de várias iterações do mesmo projeto:

- **Board Academy ×14**, incluindo `EI- Board Academy 2025` e
  `EI - Board Academy 2025` (títulos idênticos a menos de um espaço)
- **Eduardo ×9** — e são **pessoas diferentes**: Eduardo (Seguros),
  Eduardo Zandoná (2), Eduardo Bonzaki, Dr. Eduardo Clínica Gheller
- **Gabriel ×7**, Vanessa ×5, Guilherme ×5, Keney ×5, AlfaKids ×5, Plena ×5
- títulos exatamente iguais com page_ids diferentes: `EI - Eduardo`,
  `EI - Gabriel Henrique`, `EI - Junior Leão`, `EI - Beatriz`, `EI - Bruno`,
  `EI - Werley`, `Raquel`, e `Home`×4 / `Contatos`×6 / `Blog`×4 / `Sobre`×4
- cópias literais: `EI - Rogério - Catarata` e `… (copy)` têm **exatamente**
  4.018 chars; `EI - Eduardo` e `Eduardo Site Auxilio Seguros` repetem o
  mesmo bloco de acesso
- famílias "versão 2": Bruna Puga ×4 (`Bruna Puga` → `2.0` → `- 2026` →
  `2026` com só 172 chars), Jackson ×3, Ju Amorim ×3, Wagner/Tanise/Lunae/
  Sofia Rito/Raires/Lorrane/Mauro Lino/Naty/Junio César/Marcia/Vitória ×2

Uma deduplicação por nome exigiria normalizar prefixo `EI -`, espaços
duplos e sufixos (`2.0`, `2025`, `2026`, `Nova Página`, `Reformulação`,
`site`, `copy`) — e **ainda assim precisa de revisão humana**, porque
"Eduardo" e "Gabriel" agrupam pessoas distintas. Isso reforça a decisão D1
(várias EIs por cliente) e a D4 (vínculo manual).

### 2.4 🚨 `xj7td-89291` "EI - Valéria corrigida" — duplicatas

27 páginas, das quais **11 são cópias literais de páginas que já estão no
doc de 2026**, com o sufixo `(copy)` no título:

Anna Paula · Debora Aguiar · Letícia Vilarinho · Andre Rezende ·
Dr. Caros Kayque · Sofia Rito (04/2026) · Construtora OGP · Bruno 04/26 ·
Dr. Benedito Vieira · Ajudo sim · Juliana Thais/Neto Coutinho

As outras 16 são EIs que **só existem aqui**: Ei- Modelo · WC-frio
Refrigeração · Leonardo Adestra · Carolina · Dra. Eloisa · Marina · Telhas ·
Mezeco página criminal · Método Despertar · Danilo · Clarissa Proposta
comercial · Karla · Monnya · Thais Aguiar · Dra. Indira · Dra. Indira 2ª LP.

**Consequência para a importação**: a idempotência por `clickup_page_id`
protege contra rodar duas vezes, mas **não** contra duas páginas diferentes
do ClickUp com o mesmo conteúdo. Se este doc entrar inteiro, o app ganha 11
pares de documentos praticamente idênticos, com títulos quase iguais — o
tipo de ruído que fez a Karine pedir para apagar os 22 clones vazios de
briefing em 2026-09-21. Ver decisão D3.

Nota: `EI - Mezeco página criminal` aqui e `EI - Mezeco e Borges SITE` /
`EI - Mezeco página Criminal` no `xj7td-4043` explicam por que MEZECO &
BORGES aparece em §3.3 como "cliente sem EI": a EI dele existe, só não está
no doc de 2026.

---

## 3. Cruzamento app × ClickUp

Simulei o algoritmo real do app (`casarCliente` em
`src/lib/briefing-match.ts`) sobre os 73 títulos do doc de 2026 contra os 43
clientes reais da tabela `clients`. Resultado bruto:

- **37** casariam com confiança "alta"
- **0** com confiança "média"
- **36** entrariam avulsas (`client_id = null`)

**Mas a confiança "alta" mente em pelo menos 6 casos.** O algoritmo casa por
token raro, e nomes próprios curtos derrubam a régua:

| Página do ClickUp | Casaria com | Veredito |
|---|---|---|
| `EI - Adriano \| Marcas Patentes` | Krmk Marcas (Katlyn) | ❌ casou só por "marcas" |
| `EI - Dr. Benedito Vieira` | Resfriar (Patrícia dos Santos **Vieira**) | ❌ sobrenome coincidente |
| `EI - Gustavo ADS Óptica Cristal` | Gustavo Vicelli Advocacia | ❌ casou só por "gustavo" |
| `EI - Karine Serigy` | Arcano Ethos (**Karine** Medeiros) | ❌ casou só por "karine" |
| `EI - Rafael \| Dra. Mônica` | Dr. **Rafael** Rapozo | ❌ casou só por "rafael" |
| `EI - Juliana` | Celebrar Eventos (**Juliana** Bravo) | ⚠️ provável, mas não comprovado |

E erra para o outro lado também (falsos negativos que a importação anterior
já tinha resolvido à mão, no mapa `VINCULO_MANUAL`):

| Página | Cliente real | Por que não casa |
|---|---|---|
| `EI - Spactrax` | SpectraX | grafia: Sp**a**ctrax ≠ Sp**e**ctraX |
| `EI - Clémerson` | CLEMERSOM NEIS (TITANIUM) | Clémerso**n** ≠ Clemerso**m** |
| `EI - César` | CESAR ALBUQUERQUE | ficou ambíguo com JUNIO CESAR |
| `EI - Vitória` | Vittória Mulfait | Vi**t**ória ≠ Vi**tt**ória |
| `EI - Lunae Academy` | Lunnae Academy | Lu**n**ae ≠ Lu**nn**ae |

**Conclusão operacional**: o matching automático serve para ordenar o
trabalho, não para decidir. Reaproveitar o mapa `VINCULO_MANUAL` da
importação de briefings (documentado em
`memory/importacao_briefings_clickup.md`) cobre metade desses casos de
graça, porque são os mesmos clientes.

### 3.1 EIs com correspondente provável no app (37, a revisar)

Araya · Carla Albuquerque (Cma Conecta) · Danielle Martins · Dr. Alex Sasaki ·
Dr. Rafael Rapozo 2026 · Filipe · Gabriel Untura (Group6) · Gustavo Vicelli ·
Jéssica (Ethos) · Juh e William (Celebrar Eventos) · Juliana · Junio Adv 2026 ·
Karine Medeiros - Arcano Ethos · Katlyn (Krmk) · KB Marketing · Laíssa Ferreira
(Daisy) · Laurence · Lexsandra · Lunae Academy | Glicerinas · Marya Cavalcanti ·
Pablo Medeiros · Paloma · Patricia 2026 (Resfriar) · Raissa | Casal Madry
(Creatori) · Raynna Felix (Clube Maker) · Sofia Rito (04/2026) · Sofia Rito |
Nova Landing Page Jul 2026 · Sofia Rito | Setembro 2026 · Thais Machado ·
Tiago (E-mobi) · Venício · Ygor Rosa — **mais os 6 falsos positivos da
tabela acima, que precisam virar "sem cliente" ou ganhar vínculo manual.**

### 3.2 EIs sem cliente no app (36 — vão entrar avulsas)

Ajudo sim · Andre Rezende · Ari · Barbara · Bruno 04/26 · César* · Clémerson* ·
Construtora OGP · Contabilidade Grasi & Vivi · Cury Vendas · Debora Aguiar ·
Dr. Caros Kayque · Dr. Lourival · Dra. Dayara · Dra. Priscila · Eduarda ·
Eduardo Falasca · Fabielli Capital Brokers Seguros · Fabielli Sens Entulhos ·
Javier Lopes · Juliana Thais/Neto Coutinho · Letícia Rodrigues (×2) ·
Letícia Vilarinho · Luiz - NotebookLM 360 · Mayara · Página de Captura Luiz ·
Reciproka · Rodrigo · Spactrax* · Thiago · Vitória* · + `EI - Modelo`,
`EI - Modelo (copy)`, `EI - ORIENTAÇÕES` (não são EI de cliente).

`*` = tem cliente no app, só não casa automaticamente. Vínculo manual.

### 3.3 Clientes do app sem nenhuma EI no doc de 2026 (14)

Fysi Lab Digital · Balen Susin · Carla's Cleaning Service · CESAR ALBUQUERQUE* ·
Clínica Daniel Drummond · DUOCON · Fruteb/Sa · Glisten Health ·
Marco Aurelio Lameirão · MEZECO & BORGES* · PRIVATE ODONTO CLUB · SpectraX* ·
TITANIUM PROJECT* · Vittória Mulfait*

`*` = tem EI no ClickUp, só com grafia diferente (ver §3). Os demais podem
ter EI no doc histórico `xj7td-4043` — ex.: Mezeco tem 3 páginas lá.

### 3.4 Conflitos

- **1 conflito real**: `EI - Juh e William (Celebrar eventos)` × a EI que já
  existe no app para Celebrar Eventos (6 blocos, abandonada). **A do ClickUp
  deve prevalecer** — a do app é um esqueleto iniciado e nunca preenchido,
  sem `clickup_page_id`, criado em 2026-09-01.
- **0 conflitos de idempotência**: nenhuma linha `kind='ei'` tem
  `clickup_page_id`, então a primeira rodada é toda criação.
- **N conflitos de unique constraint**: ver §1.1. Sofia Rito (3), Gustavo (2),
  Karine (2), Rafael (2), Patrícia/Benedito (2 se os falsos positivos não
  forem corrigidos).

---

## 4. 🚨 Riscos de credencial

Este é o risco mais grave do plano, e ele é **muito maior do que na
importação de briefings**. Lá, uma página tinha credencial. Aqui:

> **32 das 73 páginas do doc de 2026** e **24 das 429 páginas dos docs
> históricos** contêm algo que parece credencial de cliente em texto puro.
> São **56 páginas** no conjunto medido — e o doc da Valéria (27 páginas,
> §2.4) ainda não foi varrido.

É esperado: o primeiro campo do Modelo de EI é literalmente
`#### **Dados de acesso domínio/hospedagem/wordpress:**`. A EI é, por
desenho, o lugar onde a equipe cola o acesso.

Páginas com credencial **preenchida** (rótulo `Login:`/`Senha:`/`Usuário:`/
`Acesso:` com valor, ou o campo "Dados de acesso" preenchido). **Os valores
não foram transcritos em lugar nenhum** — nem aqui, nem no scratchpad:

| Página | O que foi detectado |
|---|---|
| `EI - Reciproka` | campo dados-de-acesso + login + senha + link admin |
| `EI - Rodrigo` | campo dados-de-acesso (628 chars — bloco grande) |
| `EI - Ajudo sim` | campo dados-de-acesso + usuário + senha + link admin |
| `EI - Juliana Thais/ Neto Coutinho` | campo dados-de-acesso + senha |
| `EI - Dr. Benedito Vieira` | campo dados-de-acesso + usuário + 2 senhas + link admin |
| `EI - Sofia Rito (04/2026)` | campo dados-de-acesso + senha + link admin |
| `EI - Andre Rezende` | 2 campos dados-de-acesso + login + senha + link admin |
| `EI - Fabielli Capital Brokers Seguros` | campo dados-de-acesso + senha + link admin |
| `EI - Gustavo ADS Óptica Cristal` | campo dados-de-acesso + usuário + senha + link admin |
| `EI - Dra. Dayara` | login + senha |
| `EI - Dr. Lourival` | user + senha + 2 links admin |
| `EI - Eduardo Falasca` | campo dados-de-acesso + usuário + senha + link admin |
| `EI - Javier Lopes` | usuário + senha + 2 links admin |
| `EI - KB Marketing` | **3 pares** usuário/senha + 2 links admin |
| `EI - Filipe` | **3 pares** login/senha + 2 links admin |
| `EI - Ari` | login + senha + 2 links admin |
| `EI - Juh e William (Celebrar eventos)` | campo dados-de-acesso + 2 links admin |
| `EI - Paloma` | campo dados-de-acesso + usuário/senha preenchidos + rótulos vazios + 2 links admin |
| `EI - Raissa \| Casal Madry` | senha |
| `EI - Gustavo Vicelli` | **2 pares** usuário/senha + 3 senhas + 2 links admin |
| `EI - Venício` | senha + user + senha + link admin |
| `EI - Lexsandra` | senha |
| `EI - Contabilidade Grasi & Vivi` | usuário + senha + 4 links admin |
| `EI - Ygor Rosa` | usuário + senha |
| `EI - César` | **2 pares** acesso/senha + link admin |
| `EI - Clémerson` | **4 pares** acesso/senha |
| `EI - Tiago` | campo dados-de-acesso + login + 3 senhas |
| `EI - Mayara` | 2 senhas + 2 links admin |
| `EI - Araya` | login + senha |
| `EI - ORIENTAÇÕES` | campo dados-de-acesso preenchido (160 chars) |
| `EI - Cury Vendas` | só link admin (sem valor detectado) |
| `EI - Laurence` | só link admin (sem valor detectado) |

Nos docs históricos, mais 24 páginas — classificadas por gravidade, também
sem nenhum valor transcrito:

**Par usuário/login + senha preenchidos (11):** `EI - Alessandra (Chalfer)`
e `EI - Alessandra (Chalfer) Família especiais` (a mesma credencial repetida
nas duas, com hostinger + wp-admin + wp-login) · `EI - Dr. Carlos Kayque`
(+ registro.br) · `EI - Dr. Vinicius Benites Escoliose` (+ cPanel + FTP) ·
`EI - Beatriz` (+ registro.br + wp-admin) · `Amanda` (+ registro.br +
wp-admin) · `EI - Carla Abreu` (+ wp-admin) · `EI - Rodrigo` ·
`EI - Marcelo` (**dois** conjuntos) · `Paulo Matulja` (doc B, + wp-admin) ·
`Claudia plataforma` (doc B).

**Só senha ou só login (6):** `EI - Paula Wyton` (2 senhas + hostgator) ·
`EI - Clarissa e William` · `EI - Guilherme` · `EI - Luana` ·
`EI - Luana Albuquerque` · `EI - Rafael` (wp-admin/wp-login + login).

**Bloco de acesso com valores soltos, sem rótulo (7):**
`Amanda e Aryelly - Terra Regularização` (**9 linhas** de valores sem
rótulo) · `EI - B&G Contabilidade` (cPanel + FTP, 7 linhas) ·
`EI - Fulvio` (cPanel, 3 linhas) · `EI - Alex` (hostinger, 3 linhas) ·
`EI - Eduardo` e `Eduardo Site Auxilio Seguros` (wp-admin, 3 linhas — são
clones um do outro) · `EI - Yuri` (1 link de acesso).

Esse terceiro grupo é o mais perigoso e confirma o diagnóstico: **em cerca
de metade dos casos a credencial aparece como linha solta, sem rótulo** —
invisível para qualquer regex de `Senha:`/`Login:`. O sinal confiável não é
a palavra-chave, é o bloco `Dados de acesso domínio/hospedagem/wordpress:`
estar preenchido. A varredura também descartou 14 falsos positivos
("desenha", "senhoras", rótulo em branco do modelo, "esqueci minha senha"
em copy de página) e um match de `ftp` que estava dentro de um blob base64.

### 4.1 O que a extração atual faria — medido, não suposto

Rodei o código real do app (`markdownToBlocks` + `extrairCredenciais`, via
`npx tsx`) sobre as 71 páginas baixadas, contando sem nunca imprimir valor:

- **28 páginas** teriam credencial extraída para a coluna `credenciais`
- **78 credenciais** no total sairiam do corpo — a rotina funciona melhor do
  que o histórico sugeria
- **mas em 3 páginas a senha AINDA fica no corpo do documento**:

| Página | O que sobra | Por quê |
|---|---|---|
| `EI - Andre Rezende` | 1 senha | está num bloco **`heading` (h3)** |
| `EI - Araya` | 1 senha | está num bloco **`heading` (h3)** |
| `EI - Gustavo Vicelli` | 1 usuário + 2 senhas | o texto do bloco começa com `"* "` (resíduo de marcação), então o rótulo não está no início |

### 4.2 As duas causas, localizadas no código

**Causa 1 — `heading` nunca é checado.** Em
`src/lib/briefing-credenciais.ts`, o laço trata heading antes de qualquer
teste de credencial e já manda o bloco para a saída:

```ts
if ((bloco as { type?: string }).type === "heading") {
  const achou = RE_CONTEXTO.exec(texto);
  if (achou) contexto = texto.trim();
  janelaSolta = 0;
  saida.push(bloco);   // ← sai sem nunca passar por RE_CREDENCIAL
  continue;
}
```

Na EI isso é fatal, porque o modelo inteiro é feito de `####` — quando a
equipe preenche o acesso na própria linha do cabeçalho (`#### Senha: …`), a
senha passa direto.

**Causa 2 — `RE_CREDENCIAL` está ancorado em `^`.**

```ts
const RE_CREDENCIAL =
  /^\s*(senha|password|login|usu[áa]rio|user|e-?mail de acesso|acesso)\s*:\s*(.*)$/i;
```

Basta qualquer resíduo antes do rótulo — no Gustavo Vicelli, um `"* "` que
sobrou da conversão de markdown — para a linha deixar de casar e a senha
ficar no corpo.

Além disso, a "janela de linha solta" (`janelaSolta = 2`) só abre depois de
um **link** de área administrativa e fecha em 2 linhas. Onde a equipe colou
3 pares de acesso em sequência (Filipe, KB Marketing, Clémerson), do 3º em
diante nada é protegido se vier sem rótulo. Esse é o formato exato que
deixou a senha da Thais Machado escapar em 2026-09-21.

### 4.3 Quem veria o que escapa

Hoje a EI **não** tem link público (`share_token` existe na tabela, mas só o
briefing usa, e `getBriefingPublico` devolve `Omit<…, "credenciais">`). O
vazamento imediato, portanto, é interno — e mais amplo do que parece:

```ts
// src/app/admin/estruturas-iniciais/[docId]/page.tsx:44
if (visibleIds && doc.clientId && !visibleIds.has(doc.clientId)) { redirect(…) }
// …:49
const docs = visibleIds ? docsAll.filter((d) => !d.clientId || visibleIds.has(d.clientId)) : docsAll;
```

O escopo por cliente do papel "básico" só se aplica quando `doc.clientId`
está preenchido. **Documento avulso (`client_id = null`) é visível para
qualquer membro logado.** Como a maior parte do arquivo histórico vai entrar
avulsa (§3.2), importar sem corrigir a extração publica senha de cliente
para a equipe inteira, incluindo quem só deveria ver os próprios clientes.

E o risco futuro é maior: a spec de unificação (§3.1 de
`2026-09-21-unificacao-ei-briefing-design.md`) prevê a EI virando a tela do
projeto, com faixa de Acessos e com o briefing dentro. Uma senha no corpo
entra nessa tela sem passar por nenhum gate.

**Isto é um bloqueador de execução.** Não porque a rotina seja inútil — ela
pega 78 de ~83 — mas porque as 5 que escapam vão para documentos que toda a
equipe enxerga. Vazar 5 senhas de cliente é o mesmo problema de vazar 80.

Nota de escopo: proteger o app **não** protege o ClickUp. As senhas
continuam em texto puro lá, como já foi registrado em
`memory/importacao_briefings_clickup.md`. Trocar as senhas dos clientes é
uma conversa separada e não é escopo desta importação.

---

## 5. Conversão do conteúdo

O caminho já existe e está testado — é o mesmo da importação de briefings:

```
ClickUp API v3 (content_format=text/md)
  → markdownToBlocks()      src/lib/markdown-to-blocks.ts
  → extrairCredenciais()    src/lib/briefing-credenciais.ts  ← PRECISA ADAPTAR
  → { blocks } em ei_data (jsonb) + credenciais (jsonb)
```

`markdownToBlocks` já cobre tudo que aparece nas EIs: headings `####`,
divisores `* * *`, bullets `*   ` e `•`, checklists `- [x]`, links
`[texto](url)`, imagens, negrito/itálico aninhado e os escapes do ClickUp
(`drive\_link`). Não precisa de alteração.

`extrairCredenciais` precisa de um modo novo (ver §7, passo 1).

Formato final de uma linha:

```json
{
  "kind": "ei",
  "nome": "EI - Thais Machado",
  "is_template": false,
  "origem": "clickup",
  "clickup_page_id": "xj7td-145791",
  "client_id": "f68112d2-…" ,
  "ei_data": { "blocks": [ … ] },
  "credenciais": [ { "contexto": "…", "rotulo": "senha", "valor": "…" } ],
  "updated_at": "<date_updated da página>"
}
```

---

## 6. Idempotência

Mesma chave da importação de briefings: **`clickup_page_id`**, com índice
único parcial já criado (`ei_documents_clickup_page_id_key`).

O laço é:

1. lê todas as linhas `kind='ei'` com `clickup_page_id not null` → mapa
   `page_id → row_id`
2. para cada página do ClickUp: se o `page_id` já está no mapa, faz `UPDATE`
   de `ei_data`/`credenciais`/`nome`/`updated_at`; senão, `INSERT`
3. no `UPDATE`, **não sobrescreve `client_id`** — se a equipe corrigiu o
   vínculo à mão, a correção sobrevive à próxima sincronização (é o que
   `importarBriefingsDoClickUp` já faz, e a razão de ele existir assim)

Rodar duas vezes não duplica. Rodar depois de uma edição no ClickUp
atualiza. **Rodar depois de uma edição no app sobrescreve** — aceitável
enquanto o ClickUp é a fonte de verdade, mas vira problema no dia em que a
equipe passar a editar no app (ver decisão D5).

Páginas com menos de 40 caracteres são ignoradas (regra já existente); no
doc de 2026 nenhuma cai nesse caso.

---

## 7. Execução

Como o `CLICKUP_API_TOKEN` **não está na Vercel** (ver
`memory/limitacao_vercel_briefing_app.md` — o projeto não está na conta da
Karine, e eu não tenho o token), o botão "Sincronizar do ClickUp" não
funciona em produção. A importação anterior contornou isso pelo conector MCP,
e esse é o caminho aqui também.

**Passo 1 — corrigir `extrairCredenciais` (código, com teste).** Três
mudanças, todas apontadas por medição na §4.2:
1. **testar credencial ANTES de tratar `heading`** — hoje o heading sai
   direto para o corpo. Um heading pode ser ao mesmo tempo contexto e
   portador de valor (`#### Senha: …`);
2. **desancorar `RE_CREDENCIAL`** — trocar `^\s*` por uma tolerância a
   resíduo de marcação/bullet antes do rótulo (`^[\s*_#>•-]*`), para não
   perder a linha por causa de um `"* "`;
3. **manter a janela de linha solta aberta até o próximo heading ou divisor
   `* * *`** dentro de um contexto de acesso, em vez de fechar em 2 linhas —
   cobre os casos de 3 pares (Filipe, KB Marketing, Clémerson).

4. **tratar o bloco `Dados de acesso domínio/hospedagem/wordpress:` como
   sensível por definição** — não só quando a regex bate. A varredura dos
   429 mostrou que em ~metade dos casos a credencial está em linha solta,
   sem rótulo (`Amanda e Aryelly` tem 9 linhas assim), e nenhuma regex de
   palavra-chave alcança isso. Tudo entre esse heading e o próximo heading/
   divisor vai para `credenciais`, com o aviso de cofre ficando no corpo.
   É deliberadamente mais agressivo do que o necessário: mandar um link
   inocente para Acessos incomoda; deixar uma senha no corpo não tem volta.

**Como verificar.** O projeto não tem runner de teste (`package.json` só tem
`dev`/`build`/`lint`, sem vitest/jest), então não vale adicionar infra só
para isso. O caminho é o script que já foi usado para produzir a §4.1: um
`.mts` no scratchpad que importa as funções reais do app, roda sobre as
páginas baixadas e conta — **sem nunca imprimir valor**. Critério de pronto:
voltar **zero** páginas com credencial remanescente no corpo.

Se depois for desejável fixar isso como teste de regressão, as fixtures
precisam ser **anonimizadas** — nunca as senhas reais, porque o repositório
é público.

**Passo 2 — decidir o schema** (D1 da seção 8). Se for "várias EIs por
cliente", migration que troca `ei_documents_client_ei_unique` por um índice
não-único, espelhando o que a `20260921091934` fez com briefing. Commitar o
arquivo de migration local mesmo aplicando por MCP
(`memory/migration_drift_supabase_mcp.md`).

**Passo 3 — baixar e converter, sem passar pelo contexto.** Receita já
validada em 2026-09-21, agora para **4 docs / até 529 páginas**:
1. subagente baixa as páginas dos 4 docs e grava um JSON por página em
   `scratchpad/paginas/`. Antes de converter, **retirar os `data:` URIs**
   das 3 páginas da §2.3 — senão o conversor gera blocos de 1,7 MB;
2. `scratchpad/converter.mts` roda com `npx tsx` usando **as mesmas funções
   do app** (`markdownToBlocks`, `extrairCredenciais`, `casarCliente`) mais
   o mapa `VINCULO_MANUAL`, e emite **um `.sql` por página**;
3. outro subagente aplica os `.sql` por `execute_sql` — o SQL não passa pelo
   contexto de ninguém.

Armadilhas já pagas, repetidas aqui para não custarem de novo:
- emitir `null::jsonb` e `'…'::uuid` — o Postgres tipa `null` cru como
  `text` e recusa a coluna `jsonb`, falhando no planejamento (falha em tempo
  de PLANEJAMENTO, então nada entra pela metade);
- **minificar o JSON dos blocos**: tirar `styles:{}`, `children:[]` e props
  no valor padrão do BlockNote cortou 49% na importação de briefings. Aqui
  importa mais: são 1,8 MB só no doc de 2026 (§2.2), e o documento do
  Rafael Rapozo sozinho dá 90 KB. `normalize()` em
  `ei-documents-server.ts` só exige `ei_data.blocks` ser array — o
  BlockNote repõe os defaults na leitura, então minificar é seguro;
- nunca deixar subagente transcrever JSON grande à mão: erra em silêncio —
  é a razão de a verificação por hash do passo 4 existir.

**Passo 4 — verificação por hash.** Mesma técnica da importação anterior:
para cada página, `md5` do texto extraído dos blocos (concatenação de
`blockPlainText` de `src/lib/markdown-to-blocks.ts`), comparando o **arquivo
local** com o que voltou do **banco**. Qualquer divergência = linha
corrompida no transporte. Sem isso, um documento entra truncado e ninguém
percebe.

Checagens complementares, em SQL:

```sql
-- toda página importada virou linha?
select count(*) from ei_documents where kind='ei' and origem='clickup';
-- nenhuma ficou sem blocos?
select id, nome from ei_documents
 where kind='ei' and jsonb_array_length(coalesce(ei_data->'blocks','[]'::jsonb)) = 0;
-- nenhuma palavra-chave de credencial sobrou no CORPO?
select id, nome from ei_documents
 where kind='ei' and ei_data::text ~* '(senha|password)\s*[:"]';
```

A terceira é a que importa: ela precisa voltar **zero linhas**. Se voltar
alguma, a extração do passo 1 não cobriu aquele formato.

**Passo 5 — limpeza.** Decidir o que fazer com a EI de Celebrar Eventos que
já existe no app (§3.4). A importação de briefings apagou 22 clones vazios
equivalentes; aqui é 1 só.

---

## 8. O que precisa de decisão da Karine antes de rodar

**D1 — Várias EIs por cliente?** 🚨 bloqueador de schema.
A Sofia Rito tem 3 EIs em 2026 (abril, julho, setembro) e mais no histórico.
Hoje o banco só aceita 1 por cliente. Opções:
(a) liberar várias por cliente, como já foi feito com briefing — cada EI é um
projeto/página, e o histórico fica visível na ficha;
(b) manter 1 por cliente e importar só a mais recente, deixando as antigas
avulsas;
(c) manter 1 por cliente e importar todas as antigas avulsas, sem vínculo.
Recomendação: **(a)** — é o que o pedido ("deixar um banco de dados salvo")
pede, e é o mesmo caminho que o briefing já tomou.

**D2 — O que fazer com as credenciais?** 🚨 bloqueador de segurança.
32 páginas têm acesso de cliente. O plano manda tudo para a coluna
`credenciais` (fora do corpo, só para quem tem acesso total). Confirmar que é
isso mesmo — e decidir se o arquivo histórico (clientes que não são mais
clientes) deve guardar credencial **ou descartar o valor** e manter só a nota
de que existia. Descartar é mais seguro e provavelmente suficiente para um
arquivo.

**D3 — Qual é o recorte do arquivo?** São **529 páginas** em 4 docs.
Três perguntas dentro de uma:
- **(a) Páginas que não são EI.** ~100 são navegação de site antigo
  (`Home`, `Sobre`, `Blog`, `Contatos`, `SEGURO DE VIDA`,
  `Cirurgias Faciais`) e ~60 são o modelo em branco. Sugestão: importar só
  as >2.200 chars (329 + 69 = ~400), deixando o resto de fora — o corte foi
  validado: 299 das 329 têm >1.000 chars de conteúdo único.
- **(b) Duplicatas.** 58% das páginas dos históricos são iterações do mesmo
  cliente, e o doc da Valéria traz 11 cópias literais de páginas de 2026
  (§2.4). Importar tudo é fiel ao histórico mas enche a tela; consolidar
  exige revisão humana. Sugestão: importar tudo **exceto** as cópias
  literais do doc da Valéria, que não acrescentam nada.
- **(c) As 3 páginas com imagem base64** (§2.3): subir a imagem para o
  Storage, ou descartar a imagem e ficar só com o texto? Para um arquivo
  histórico, descartar é defensável e evita 3,6 MB de `data:` URI no banco.

**D4 — Quem é quem?** As 6 correspondências falsas da §3 e os 5 falsos
negativos precisam de confirmação humana. Sem isso, EI de cliente antigo
aparece na ficha do cliente errado — que é exatamente o risco que
`briefing-match.ts` foi escrito para evitar ("errar o vínculo é pior que não
vincular").

**D5 — A sidebar aguenta o arquivo?**
`src/components/admin/ei-document-sidebar.tsx` é uma **lista plana com
busca por título**. Documentos avulsos aparecem normalmente (o filtro de
visibilidade em `[docId]/page.tsx:49` deixa passar `!d.clientId`), então a
importação não some da tela. Mas jogar 250+ itens numa lista plana torna a
tela inútil para o uso diário: a EI do cliente ativo fica perdida entre
`EI - Werley` de 2024 e três `EI - Modelo (copy)`.

Mínimo necessário junto com a importação: separar "ativos" de "arquivo" na
sidebar — por exemplo agrupando por `origem`/`client_id`, ou um filtro
"mostrar arquivo histórico" desligado por padrão. Sem isso a importação
entrega o dado e quebra a usabilidade, que é o oposto do princípio de
"editável / ordenável / claro" já acordado para o admin.

**D6 — Depois da importação, quem é a fonte de verdade?**
Se a equipe continuar editando no ClickUp, sincronizar de novo é seguro. Se
passar a editar no app, a próxima sincronização sobrescreve. Precisa de uma
regra: ou congela a importação (roda uma vez, vira arquivo), ou o app passa a
ser read-only para os importados, ou compara `updated_at`.

**D7 — Token do ClickUp na Vercel.** Enquanto `CLICKUP_API_TOKEN` não
estiver lá, não existe botão "Sincronizar" funcionando em produção para EI;
toda importação depende de mim rodando pelo conector. Se a intenção é que a
equipe sincronize sozinha, o token precisa ser configurado.

---

## 9. O que este levantamento NÃO fez

- Não escreveu nada no banco (nenhum INSERT/UPDATE/DELETE/migration).
- Não alterou nada no ClickUp.
- Não transcreveu nenhum valor de credencial para arquivo nenhum — o
  repositório é público.
- Não conferiu ao vivo a tela `/admin/estruturas-iniciais` com dados reais.
- **Não mediu o doc `xj7td-89291` ("EI - Valéria corrigida", 27 páginas)**:
  só listou os títulos. Tamanho de conteúdo e varredura de credencial dessas
  27 ficam pendentes.
- Não esgotou a busca por docs de EI no ClickUp (§2.2) — pode existir um
  quinto doc.
- O cruzamento da §3 cobre apenas as 73 páginas do doc de 2026. Os ~400
  títulos dos históricos não foram cruzados com `clients` (a maioria é de
  cliente antigo que não existe mais na tabela, mas há exceções: Mezeco,
  Lunae, Sofia Rito, Vitória).
