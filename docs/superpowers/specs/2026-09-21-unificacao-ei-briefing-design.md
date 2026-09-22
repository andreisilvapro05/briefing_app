# Unificação da Estrutura Inicial com o Briefing — design

> Spec de design. Não implementa código. Aterrada no estado real do
> `briefing_app` em 2026-09-21.

## 1. O problema

Hoje a mesma informação vive em três lugares, e quem produz a página precisa
consultar os três.

| Onde | O que é | Tamanho real |
|---|---|---|
| `ei_documents` kind=`ei` | Camada de **produção**: acessos, Figma, drive, botões, copy | 22 blocos |
| `ei_documents` kind=`briefing` | Camada de **descoberta**, preenchida na call ou vinda do ClickUp | ~150 blocos |
| `briefing_responses` | O mesmo, respondido pelo cliente sozinho no app | 7 blocos de perguntas |

**A repetição está nos ativos.** Logo, cores, fontes, referências visuais,
imagens/drive, copy e os acessos de domínio aparecem nos três. Sempre no
mesmo sentido: **o cliente informa, a equipe consome.**

O que NÃO se repete: Figma e link dos botões são só da EI; público, dores,
objeções e tom de marca são só do briefing.

Sinal de que a união já era intenção: o modelo de EI tem um campo chamado
apenas **"Briefing:"**, que hoje é um link solto.

## 2. Decisões tomadas

Duas escolhas da Karine (2026-09-21) fecham o desenho:

1. **As duas origens aparecem, identificadas.** Quando o cliente preencheu o
   formulário E a equipe preencheu na call, a EI mostra as duas seções com a
   origem visível. Nada se perde, e dá pra ver onde o cliente foi vago e a
   call esclareceu.
2. **Acessos saem do corpo do documento.** Login e senha viram bloco próprio,
   fora do texto, que nunca entra no link público e só aparece para quem tem
   acesso financeiro.

A segunda decisão já tem urgência comprovada: em 2026-09-21 a importação do
ClickUp trouxe o briefing da Thais Machado com a senha do WordPress dela solta
no meio do texto (ver `importacao_briefings_clickup` na memória).

## 3. Desenho

### 3.1 Uma tela, quatro faixas

A Estrutura Inicial passa a ser **o projeto do cliente**, com o briefing
dentro. Quatro faixas, nesta ordem:

1. **Acessos** — domínio, hospedagem, WordPress. Lido de
   `ei_documents.credenciais` (coluna que já existe e que a importação já
   alimenta). Fora do corpo. Exige `hasFinanceAccess`. Nunca renderizado em
   `/b/[token]`.
2. **Produção** — Figma, drive, link dos botões, copy final. É o que resta da
   EI de hoje.
3. **Briefing** — duas seções identificadas:
   - *"O cliente respondeu"* — render de `briefing_responses`
   - *"Preenchido na call"* — render do documento `kind=briefing`
   Cada uma com selo de origem e link para editar na fonte.
4. **Ativos** — logo, cores, fontes, imagens, referências. **Lidos do
   briefing**, não redigitados. É aqui que a repetição morre.

### 3.2 Os dados não se fundem

Continuam dois registros (`kind=ei` e `kind=briefing`). Motivo: o briefing
precisa do `share_token` próprio (o link público que vai para a designer e
para o cliente) e do `clickup_page_id` (idempotência da importação). Fundir
exigiria migrar 34 documentos importados e reescrever a revogação de link —
risco alto para ganho nenhum, já que **o que incomoda é a apresentação**.

O que muda no dado: **remover do modelo de EI** os campos logo, imagens,
fonte, cores, referências visuais e o campo "Briefing:". Isso é edição do
documento-modelo, não migração de schema.

### 3.3 Um hub só

"Estruturas Iniciais" e "Briefings" viram uma entrada de menu, preservando as
abas atuais (documentos, modelos, respostas). O link público continua sendo
do briefing, com token próprio, renderizando **apenas** as seções de briefing.

## 4. O que fica de fora (YAGNI)

- **Fundir as tabelas.** Ver 3.2.
- **Campos estruturados por ativo** (cor como campo, não como texto). Seria o
  ideal a longo prazo — o dado teria um lugar só e apareceria onde precisasse
  — mas exige migrar o que já existe e um editor novo. Fica anotado como
  direção, não como escopo.
- **Mesclar campo a campo** as duas origens. A Karine escolheu ver as duas
  lado a lado; mesclar esconderia divergência entre o que o cliente escreveu
  e o que foi dito na call.
- **Editar o briefing de dentro da EI.** Na primeira versão a seção de
  briefing é leitura com link para a fonte. Dois editores de bloco na mesma
  tela é peso e conflito de foco.

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Alguém compartilha a EI achando que compartilha só o briefing | O link público continua sendo **do briefing**. A EI não ganha link. |
| Acessos vazarem numa seção futura | Acessos ficam fora do corpo, numa faixa com gate próprio — não é uma seção do documento que alguém possa esquecer de filtrar. |
| Cliente sem briefing vê a tela quebrada | Cada faixa tem estado vazio próprio, com o convite para criar a partir do Modelo. |

## 6. Como saber que deu certo

- Abrir a EI de um cliente e enxergar, sem trocar de tela: acessos, Figma,
  drive, o que o cliente respondeu e o que foi dito na call.
- O modelo de EI deixa de ter campos de logo/cores/fontes.
- `/b/[token]` continua mostrando só o briefing, e nunca os acessos.
