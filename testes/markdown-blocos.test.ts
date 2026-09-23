import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToBlocks, blockPlainText } from "../src/lib/markdown-to-blocks.ts";

/**
 * A regra que este arquivo protege: o texto entra e o texto sai.
 *
 * Por aqui passaram as 62 Estruturas Iniciais e os 34 briefings importados
 * do ClickUp. Um erro neste conversor não dá erro: grava o documento do
 * cliente torto e só aparece meses depois, quando alguém abre a página e a
 * decisão que estava escrita ali não está mais.
 *
 * Todos os dados são INVENTADOS — o repositório é público.
 */

type Bloco = { type?: string; props?: Record<string, unknown>; content?: unknown };

/** Atalhos pra ler o resultado sem depender da forma interna do bloco. */
const tipos = (md: string) => (markdownToBlocks(md) as Bloco[]).map((b) => b.type);
const textos = (md: string) =>
  (markdownToBlocks(md) as Bloco[]).map((b) => blockPlainText(b as never));
const um = (md: string) => markdownToBlocks(md)[0] as Bloco;

/**
 * Tudo que o documento convertido ainda carrega: o texto dos blocos, a
 * legenda e o endereço da imagem, e o destino de cada link. É a
 * "reconstituição" — o lado direito da invariante.
 */
function textoDoDocumento(md: string): string {
  return (markdownToBlocks(md) as Bloco[])
    .map((b) => {
      const props = (b.props ?? {}) as { caption?: string; url?: string };
      const destinos = Array.isArray(b.content)
        ? (b.content as { type?: string; href?: string }[])
            .filter((n) => n.type === "link")
            .map((n) => n.href ?? "")
        : [];
      return [blockPlainText(b as never), props.caption ?? "", props.url ?? "", ...destinos].join(" ");
    })
    .join("\n");
}

/**
 * As palavras do markdown original, tirando só o que é marcação (cerca de
 * código, `#`, `*`, `_`, colchete, parêntese) e desfazendo os escapes do
 * ClickUp. O que sobra é conteúdo, e conteúdo não pode sumir.
 */
function palavras(md: string): string[] {
  return md
    .replace(/```[a-zA-Z]*/g, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!~|])/g, "$1")
    // `\u2022` e `\u2060` (o bullet literal do ClickUp e o word joiner que
    // vem colado nele) são marcação, não conteúdo.
    .replace(/[#*_`>[\]()|!\u2022\u2060]/g, " ")
    .split(/\s+/)
    .map((s) => s.replace(/^[-.,:;]+|[-.,:;]+$/g, ""))
    .filter((s) => s.length >= 2);
}

// --- A invariante central -------------------------------------------------

test("nenhuma palavra do documento some na conversão", () => {
  const documentos: [string, string][] = [
    [
      "Estrutura Inicial no formato do ClickUp",
      [
        "#### **Estrutura Inicial**",
        "",
        "* * *",
        "",
        "**Cliente:** Padaria Aurora",
        "**Responsável:** Tainá",
        "",
        "##### Identidade",
        "",
        "*   Paleta definida com o cliente",
        "*   Tipografia serifada",
        "",
        "- [x] Uma única cor no fundo (Mais clara)",
        "- [ ] Fundo com degradê",
        "",
        "Materiais em [Drive da conta](https://drive.exemplo.fake/pasta?usp=drive\\_link).",
      ].join("\n"),
    ],
    [
      "briefing com lista numerada, citação e imagem",
      [
        "## Briefing do site",
        "",
        "1. Objetivo: vender assinatura mensal",
        "2. Público: escritórios pequenos",
        "3. Prazo combinado: outubro",
        "",
        "> O cliente pediu algo clean, sem exagero.",
        "",
        "![Logotipo enviado](https://arquivos.exemplo.fake/logo.png)",
        "",
        "Referências: [Behance](https://behance.exemplo.fake/perfil) e [Meu Negócio](https://negocio.exemplo.fake/ficha).",
      ].join("\n"),
    ],
    [
      "página com bloco de código e acentuação",
      [
        "### Configuração",
        "",
        "Trecho combinado com a hospedagem:",
        "",
        "```",
        "servidor = producao",
        "",
        "porta = 8080",
        "```",
        "",
        "Observação: manutenção às terças, inclusão do rodapé na revisão.",
      ].join("\n"),
    ],
    [
      "marcadores literais que o ClickUp exporta",
      ["•⁠ ⁠Entrega da home", "•⁠ ⁠Entrega da página de contato", "- Revisão final"].join("\n"),
    ],
    [
      "negrito e itálico aninhados",
      "**_É mais para acolher_** do que para impressionar, disse a cliente.",
    ],
  ];

  for (const [nome, md] of documentos) {
    const saida = textoDoDocumento(md);
    for (const palavra of palavras(md)) {
      assert.ok(saida.includes(palavra), `sumiu "${palavra}" em: ${nome}`);
    }
  }
});

// --- Os elementos que as páginas reais usam -------------------------------

test("título vira heading e o nível nunca passa de 3", () => {
  const blocos = markdownToBlocks("# um\n## dois\n### três\n#### quatro\n###### seis") as Bloco[];
  assert.deepEqual(blocos.map((b) => b.type), Array(5).fill("heading"));
  assert.deepEqual(blocos.map((b) => b.props?.level), [1, 2, 3, 3, 3]);
});

test("o negrito que o ClickUp põe no título não vira texto visível", () => {
  // O export vem como `#### **Identidade Visual**`; os asteriscos não podem
  // aparecer no documento do cliente.
  assert.deepEqual(textos("#### **Identidade Visual**"), ["Identidade Visual"]);
});

test("divisor é divisor nas três formas que aparecem", () => {
  assert.deepEqual(tipos("* * *\n---\n___"), ["divider", "divider", "divider"]);
});

test("marcador de lista: asterisco, hífen e o bullet literal do ClickUp", () => {
  // O ClickUp exporta `•` seguido de U+2060 (word joiner) — sem tratar isso,
  // o item virava parágrafo com o bullet impresso no meio do texto.
  assert.deepEqual(
    tipos("*   um\n-   dois\n+   três\n•⁠ ⁠quatro"),
    Array(4).fill("bulletListItem")
  );
  assert.deepEqual(textos("•⁠ ⁠quatro"), ["quatro"]);
});

test("checklist guarda a decisão do cliente, marcada ou não", () => {
  const blocos = markdownToBlocks("- [x] Uma única cor\n- [ ] Degradê\n* [X] Maiúsculo") as Bloco[];
  assert.deepEqual(blocos.map((b) => b.type), Array(3).fill("checkListItem"));
  assert.deepEqual(blocos.map((b) => b.props?.checked), [true, false, true]);
  assert.deepEqual(blocos.map((b) => blockPlainText(b as never)), [
    "Uma única cor",
    "Degradê",
    "Maiúsculo",
  ]);
});

test("item numerado em branco do modelo continua sendo item da lista", () => {
  // "1.", "2.", "3." sem texto são os campos a preencher do modelo de EI.
  // Virar parágrafo solto perderia a lista que o cliente vai completar.
  assert.deepEqual(tipos("1.\n2.\n3. respondido"), Array(3).fill("numberedListItem"));
});

test("link guarda rótulo e destino, inclusive dois na mesma linha", () => {
  const conteudo = um("Veja [a home](https://um.exemplo.fake) e [o blog](https://dois.exemplo.fake) hoje")
    .content as { type?: string; text?: string; href?: string; content?: { text?: string }[] }[];
  const links = conteudo.filter((n) => n.type === "link");
  assert.deepEqual(links.map((n) => n.href), [
    "https://um.exemplo.fake",
    "https://dois.exemplo.fake",
  ]);
  assert.deepEqual(links.map((n) => n.content?.[0]?.text), ["a home", "o blog"]);
  assert.equal(blockPlainText(um("Veja [a home](https://um.exemplo.fake) e [o blog](https://dois.exemplo.fake) hoje") as never), "Veja a home e o blog hoje");
});

test("o escape do ClickUp sai do destino do link", () => {
  // `drive\_link` é como o ClickUp escapa a URL do Drive. A barra invertida
  // no endereço quebra o link de material do cliente.
  const link = (um("Pasta: [Drive](https://drive.exemplo.fake/x?usp=drive\\_link)").content as {
    type?: string;
    href?: string;
  }[]).find((n) => n.type === "link");
  assert.equal(link?.href, "https://drive.exemplo.fake/x?usp=drive_link");
});

test("link pelado usa a própria URL como rótulo, e não fica sem texto", () => {
  assert.equal(
    blockPlainText(um("[https://ex.exemplo.fake/a](https://ex.exemplo.fake/a)") as never),
    "https://ex.exemplo.fake/a"
  );
});

test("imagem guarda endereço e legenda", () => {
  const img = um("![Logo do cliente](https://arquivos.exemplo.fake/logo.png)");
  assert.equal(img.type, "image");
  assert.equal(img.props?.url, "https://arquivos.exemplo.fake/logo.png");
  assert.equal(img.props?.caption, "Logo do cliente");
});

test("negrito por fora e itálico por dentro não vazam marcador nenhum", () => {
  const partes = um("**_é mais para acolher_** do que impressionar").content as {
    text?: string;
    styles?: Record<string, boolean>;
  }[];
  assert.equal(blockPlainText(um("**_é mais para acolher_** do que impressionar") as never), "é mais para acolher do que impressionar");
  assert.deepEqual(partes[0]?.styles, { bold: true, italic: true });
  assert.equal(partes.some((p) => (p.text ?? "").includes("*") || (p.text ?? "").includes("_")), false);
});

test("bloco de código preserva as linhas, inclusive a em branco do meio", () => {
  const b = um("```\nlinha um\n\nlinha três\n```");
  assert.equal(b.type, "codeBlock");
  assert.equal(blockPlainText(b as never), "linha um\n\nlinha três");
});

// --- O hostil: nada pode lançar e nada pode sair vazio --------------------

test("entrada hostil nunca lança e nunca devolve documento sem bloco", () => {
  const hostis = [
    "",
    "   ",
    "\n\n\n",
    "\t \n  \t",
    "*",
    "**",
    "###### ",
    "######",
    "[texto sem fechar(url)",
    "veja [rótulo]() aqui",
    "![](  )",
    "`",
    "```",
    "> ",
    "- [ ]",
    "|",
    "\\",
    "a".repeat(20000),
    "*".repeat(3000),
    "a*b_".repeat(2000),
    "[".repeat(2000),
  ];
  for (const md of hostis) {
    const blocos = markdownToBlocks(md);
    assert.ok(Array.isArray(blocos), JSON.stringify(md));
    assert.ok(blocos.length >= 1, `documento sem bloco: ${JSON.stringify(md.slice(0, 20))}`);
    for (const b of blocos as Bloco[]) {
      assert.equal(typeof blockPlainText(b as never), "string");
    }
  }
});

test("markdown vazio ou só de espaço vira um parágrafo vazio, não lista vazia", () => {
  // O BlockNote não monta o editor com lista de blocos vazia.
  for (const md of ["", "   ", "\n\n"]) {
    assert.deepEqual(tipos(md), ["paragraph"]);
    assert.deepEqual(textos(md), [""]);
  }
});

test("linha de milhares de caracteres chega inteira", () => {
  const linha = "palavra ".repeat(5000).trim();
  const saida = textos(linha);
  assert.equal(saida.length, 1);
  assert.equal(saida[0], linha);
});

// --- blockPlainText: sempre string ---------------------------------------

test("blockPlainText devolve string pra qualquer bloco, conhecido ou não", () => {
  const casos: unknown[] = [
    {},
    { type: "divider", props: {} },
    { type: "paragraph", content: [] },
    { type: "image", props: { url: "https://ex.exemplo.fake/a.png" } },
    { type: "tabela_que_ainda_nao_existe", content: [{ type: "text", text: "oi" }] },
    { type: "paragraph", content: "texto cru em vez de lista" },
    { type: "paragraph", content: [{ type: "mention", usuario: "sem campo text" }] },
  ];
  for (const b of casos) {
    assert.equal(typeof blockPlainText(b as never), "string", JSON.stringify(b));
  }
  assert.equal(blockPlainText({} as never), "");
  assert.equal(blockPlainText({ type: "paragraph", content: [] } as never), "");
  assert.equal(
    blockPlainText({ type: "tabela_que_ainda_nao_existe", content: [{ type: "text", text: "oi" }] } as never),
    "oi"
  );
});

test("blockPlainText entra no conteúdo aninhado do link", () => {
  const bloco = {
    type: "paragraph",
    content: [
      { type: "text", text: "materiais em " },
      { type: "link", href: "https://drive.exemplo.fake", content: [{ type: "text", text: "Drive" }] },
      { type: "text", text: "." },
    ],
  };
  assert.equal(blockPlainText(bloco as never), "materiais em Drive.");
});

// --- Bugs reais encontrados: marcados, não consertados --------------------

test(
  "cerca de código não fechada não pode engolir o resto do documento",
  () => {
    // Uma página do ClickUp com um ``` solto (acontece quando alguém cola um
    // trecho e esquece de fechar) perde TODO o conteúdo seguinte, sem erro.
    const saida = textoDoDocumento("Antes da cerca\n```\ndentro\ndepois da cerca sem fechar");
    assert.ok(saida.includes("Antes da cerca"));
    assert.ok(saida.includes("dentro"), "o conteúdo depois da cerca aberta desaparece");
    assert.ok(saida.includes("depois da cerca sem fechar"));
  }
);

test(
  "número com ponto de milhar não pode perder o primeiro dígito",
  () => {
    // "1.500 reais" casa com a regra de lista numerada (`1.`) e o "1." é
    // comido: o valor combinado com o cliente vira 500.
    assert.deepEqual(textos("1.500 reais de investimento"), ["1.500 reais de investimento"]);
    assert.deepEqual(textos("2.500,00 fechado em contrato"), ["2.500,00 fechado em contrato"]);
  }
);

test(
  "dois escapes do ClickUp na mesma linha não podem virar itálico",
  () => {
    // Com UM escape funciona; com DOIS, os `_` escapados são lidos como
    // marcadores de itálico e o resultado sai "drive\\link ... outro\\link".
    assert.deepEqual(textos("Veja drive\\_link no final"), ["Veja drive_link no final"]);
    assert.deepEqual(textos("Arquivo em drive\\_link e também em outro\\_link"), [
      "Arquivo em drive_link e também em outro_link",
    ]);
  }
);

test(
  "sublinhado no meio da palavra não pode sumir do texto",
  () => {
    // Markdown de verdade não abre ênfase com `_` no meio de uma palavra,
    // justamente por isso. Aqui abre, e os sublinhados somem: nome de
    // arquivo combinado com o cliente e URL do Drive colada crua (que é
    // como ela chega quando ninguém usa a sintaxe de link) saem quebrados.
    assert.deepEqual(textos("O certo é arquivo_final_v2.pdf, não o antigo"), [
      "O certo é arquivo_final_v2.pdf, não o antigo",
    ]);
    assert.deepEqual(textos("https://drive.exemplo.fake/file/d/ab_cd_ef/view"), [
      "https://drive.exemplo.fake/file/d/ab_cd_ef/view",
    ]);
  }
);
