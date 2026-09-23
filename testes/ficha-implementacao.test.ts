import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fichaVazia,
  hostDe,
  normalizarAcessos,
  normalizarBotoes,
  normalizarPixels,
  type FichaImplementacao,
} from "../src/lib/ficha-implementacao.ts";

/**
 * A ficha de implementação é a única tela que o Daniel abre — e as três
 * listas dela (botões, pixels, acessos) chegam do NAVEGADOR, como JSON num
 * input escondido. Quem abrir as ferramentas do navegador manda o que
 * quiser; o banco, que é jsonb, aceita. Os normalizadores são a única
 * defesa entre isso e a tela.
 *
 * As regras que estas verificações protegem:
 *   1. entrada torta nunca LANÇA — exceção aqui derruba a ficha inteira, e
 *      o Daniel fica sem acesso nenhum em vez de ficar sem um botão;
 *   2. o que sai é sempre lista de objetos com os campos conhecidos e
 *      todos em texto — a tela imprime esses campos direto;
 *   3. linha vazia não vira linha fantasma, e linha meio preenchida não
 *      desaparece calada.
 *
 * TODO valor aqui é INVENTADO. O repositório é público: nenhum dado de
 * cliente, nenhuma senha real, nenhum link real de Figma.
 */

/** Tudo que não é lista: é o que chega quando o JSON do input vem torto. */
const NAO_E_LISTA: unknown[] = [
  null,
  undefined,
  "texto",
  "[]",
  42,
  0,
  true,
  false,
  {},
  { botoes: [] },
  NaN,
];

/** Itens que não são objeto, misturados dentro de uma lista de verdade. */
const ITENS_LIXO: unknown[] = [null, undefined, 42, "texto", true, [], ""];

const NORMALIZADORES = [
  ["normalizarBotoes", normalizarBotoes],
  ["normalizarPixels", normalizarPixels],
  ["normalizarAcessos", normalizarAcessos],
] as const;

// ---------------------------------------------------------------------------
// Entrada hostil — as três listas se defendem igual
// ---------------------------------------------------------------------------

test("o que não é lista vira lista vazia, e nunca exceção", () => {
  for (const [nome, fn] of NORMALIZADORES) {
    for (const cru of NAO_E_LISTA) {
      const saida = fn(cru);
      assert.ok(Array.isArray(saida), `${nome}(${String(cru)}) devia dar lista`);
      assert.equal(saida.length, 0, `${nome}(${String(cru)})`);
    }
  }
});

test("item que não é objeto não vira linha fantasma na tela", () => {
  // Uma lista de números é o que sai de um copiar e colar errado no
  // console. Cada um desses viraria uma linha em branco na ficha.
  for (const [nome, fn] of NORMALIZADORES) {
    assert.deepEqual(fn(ITENS_LIXO), [], nome);
  }
});

test("campo faltando vira texto vazio, nunca undefined", () => {
  // A tela imprime {b.destino} direto: undefined ali some sem avisar, e
  // pior, `hostDe(undefined)` seria uma exceção dentro do render.
  const [botao] = normalizarBotoes([{ rotulo: "Quero orçamento" }]);
  assert.deepEqual(botao, { rotulo: "Quero orçamento", destino: "" });

  const [pixel] = normalizarPixels([{ identificador: "000000000000000" }]);
  assert.deepEqual(pixel, { tipo: "", identificador: "000000000000000", observacao: "" });
});

test("campo com tipo errado não vira texto do tipo errado", () => {
  // Número não pode virar a string "42": o que não é texto é descartado,
  // porque um objeto inteiro caindo no lugar do rótulo apareceria como
  // "[object Object]" na ficha.
  const [pixel] = normalizarPixels([
    { tipo: 42, identificador: "GT-FALSO-123", observacao: { onde: "head" } },
  ]);
  assert.deepEqual(pixel, { tipo: "", identificador: "GT-FALSO-123", observacao: "" });

  const [acesso] = normalizarAcessos([
    { contexto: ["Hospedagem"], rotulo: "Login", valor: 12345 },
  ]);
  assert.deepEqual(acesso, { contexto: "Acessos", rotulo: "Login", valor: "" });
});

test("todo campo que sai é texto, aconteça o que acontecer na entrada", () => {
  const hostil = [
    { rotulo: 1, destino: 2, tipo: 3, identificador: 4, observacao: 5, contexto: 6, valor: 7 },
    { rotulo: "ok", destino: null, tipo: "ok", identificador: undefined, valor: "ok" },
    { rotulo: {}, destino: [], valor: {}, identificador: [] },
  ];
  for (const [nome, fn] of NORMALIZADORES) {
    for (const item of fn(hostil) as unknown as Record<string, unknown>[]) {
      for (const [campo, v] of Object.entries(item)) {
        assert.equal(typeof v, "string", `${nome}: ${campo} devia ser texto`);
      }
    }
  }
});

test("campo a mais no JSON não atravessa pra ficha", () => {
  // Quem manda o JSON escolhe as chaves. Só as conhecidas podem passar:
  // o que sai daqui é gravado no banco e impresso na tela.
  const [botao] = normalizarBotoes([
    { rotulo: "WhatsApp", destino: "https://wa.me/0000", onclick: "roubar()", __proto__: null },
  ]);
  assert.deepEqual(Object.keys(botao).sort(), ["destino", "rotulo"]);

  const [acesso] = normalizarAcessos([
    { contexto: "Hospedagem", rotulo: "Senha", valor: "SenhaFalsa123", nota: "vazar isto" },
  ]);
  assert.deepEqual(Object.keys(acesso).sort(), ["contexto", "rotulo", "valor"]);
});

test("espaço em volta some; linha só com espaço não vira item", () => {
  const botoes = normalizarBotoes([
    { rotulo: "  Fale conosco  ", destino: "\n https://exemplo-falso.com/contato \t" },
    { rotulo: "   ", destino: "\n\t  " },
    { rotulo: "", destino: "" },
  ]);
  assert.deepEqual(botoes, [
    { rotulo: "Fale conosco", destino: "https://exemplo-falso.com/contato" },
  ]);
});

test("linha meio preenchida sobrevive — só a totalmente vazia some", () => {
  // O botão é cadastrado antes de a página existir: primeiro o rótulo,
  // o destino vem depois. Sumir com ele faria o trabalho ser refeito.
  assert.equal(normalizarBotoes([{ rotulo: "Comprar agora" }]).length, 1);
  assert.equal(normalizarBotoes([{ destino: "#formulario" }]).length, 1);
  assert.equal(normalizarPixels([{ observacao: "instalar só na página de obrigado" }]).length, 1);
  assert.equal(normalizarAcessos([{ rotulo: "Login" }]).length, 1);
  assert.equal(normalizarAcessos([{ valor: "usuario.falso" }]).length, 1);
});

test("texto gigante não derruba nem é cortado na leitura", () => {
  // Cortar é trabalho de quem GRAVA (MAX_TEXTO na action). Se a leitura
  // cortasse também, um script de pixel longo já salvo apareceria pela
  // metade — e um script pela metade é pior que nenhum.
  const gigante = "x".repeat(200_000);
  const [pixel] = normalizarPixels([{ tipo: "Meta", identificador: gigante, observacao: "" }]);
  assert.equal(pixel.identificador.length, 200_000);
});

test("lista maior que o limite de escrita é mostrada inteira", () => {
  // MAX_ITENS (60) é do caminho de escrita. A leitura não pode aplicar o
  // mesmo corte: acesso gravado antes do limite, ou pela importação de EI,
  // sumiria da tela sem ninguém apagar nada.
  const muitos = Array.from({ length: 200 }, (_, i) => ({
    contexto: "Hospedagem",
    rotulo: `Login ${i}`,
    valor: `usuario.falso.${i}`,
  }));
  assert.equal(normalizarAcessos(muitos).length, 200);
});

test("lista com buraco (array esparso) não vira item indefinido", () => {
  const esparso = new Array(3);
  esparso[1] = { rotulo: "Assinar", destino: "https://exemplo-falso.com/assinar" };
  assert.equal(normalizarBotoes(esparso).length, 1);
});

// ---------------------------------------------------------------------------
// Acessos — o dado mais sensível da ficha
// ---------------------------------------------------------------------------

test("acesso sem contexto ganha um grupo, porque a tela imprime a etiqueta", () => {
  for (const contexto of [undefined, "", "   ", null, 7]) {
    const [a] = normalizarAcessos([{ contexto, rotulo: "Senha", valor: "SenhaFalsa123" }]);
    assert.equal(a.contexto, "Acessos", `contexto ${JSON.stringify(contexto)}`);
  }
});

test("acesso só com contexto não vira credencial vazia", () => {
  // "Hospedagem" sozinho não é acesso nenhum: viraria um cartão com um
  // botão de copiar que copia string vazia.
  assert.deepEqual(normalizarAcessos([{ contexto: "Hospedagem" }]), []);
});

// ---------------------------------------------------------------------------
// hostDe — o rótulo curto do link
// ---------------------------------------------------------------------------

test("mostra o host limpo no lugar do link comprido", () => {
  assert.equal(hostDe("https://www.figma.com/file/AAA111/Home?node-id=1-2&t=abc"), "figma.com");
  assert.equal(hostDe("https://app.exemplo-falso.com/painel"), "app.exemplo-falso.com");
  assert.equal(hostDe("https://exemplo-falso.com:8443/admin"), "exemplo-falso.com:8443");
  assert.equal(hostDe("HTTPS://WWW.Exemplo-Falso.COM/A"), "exemplo-falso.com");
  assert.equal(hostDe("  https://exemplo-falso.com/a  "), "exemplo-falso.com");
});

test("senha embutida no link não aparece no rótulo", () => {
  // Destino colado do navegador pode vir com usuário e senha. O rótulo é
  // o que fica visível na tela (e em print de tela): só o host.
  const host = hostDe("https://admin:SenhaFalsa123@painel.exemplo-falso.com/wp-admin");
  assert.equal(host, "painel.exemplo-falso.com");
  assert.ok(!host?.includes("SenhaFalsa123"));
});

test("destino que não é URL volta null, e a tela mostra o texto como veio", () => {
  // O destino pode ser uma âncora ou um recado pra equipe — isso não é
  // erro, é uso normal da ficha.
  for (const cru of [
    "",
    "   ",
    "#formulario",
    "mesmo do botão do topo",
    "figma.com/file/AAA111",
    "//figma.com/file/AAA111",
    "wa.me/5599999",
  ]) {
    assert.equal(hostDe(cru), null, JSON.stringify(cru));
  }
});

test("esquema sem host não devolve rótulo de link", () => {
  // `new URL("javascript:...")` NÃO lança — devolve uma URL de host vazio.
  // Nenhum destes pode sair daqui parecendo um domínio clicável.
  for (const cru of [
    "javascript:alert(1)",
    "javascript:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "mailto:contato@exemplo-falso.com",
    "tel:+5599999999",
    "file:///Users/fulano/arquivo.html",
  ]) {
    assert.ok(!hostDe(cru), `${cru} não pode virar rótulo de link`);
  }
});

test("entrada que não é texto não derruba a tela", () => {
  // O destino vem do jsonb: o tipo é promessa do TypeScript, não do banco.
  for (const cru of [null, undefined, 42, {}, []]) {
    assert.equal(hostDe(cru as unknown as string), null, String(cru));
  }
});

// ---------------------------------------------------------------------------
// fichaVazia — decide se o Daniel vê "nada preenchido ainda"
// ---------------------------------------------------------------------------

function ficha(patch: Partial<FichaImplementacao> = {}): FichaImplementacao {
  return {
    docId: "doc-falso-1",
    clientId: "cliente-falso-1",
    titulo: "Cliente Inventado",
    figmaUrl: null,
    botoes: [],
    pixels: [],
    acessos: [],
    atualizadoEm: "2026-09-22T12:00:00.000Z",
    ...patch,
  };
}

test("ficha sem nada é vazia", () => {
  assert.equal(fichaVazia(ficha()), true);
  assert.equal(fichaVazia(ficha({ figmaUrl: "" })), true);
});

test("um único item preenchido já tira a ficha do estado vazio", () => {
  // Errar aqui é o pior defeito desta tela: o Daniel lê "nada preenchido
  // ainda", não pede nada pra equipe, e o dado estava lá o tempo todo.
  const casos: Partial<FichaImplementacao>[] = [
    { figmaUrl: "https://www.figma.com/file/AAA111/Home" },
    { botoes: [{ rotulo: "Comprar", destino: "" }] },
    { botoes: [{ rotulo: "", destino: "#formulario" }] },
    { pixels: [{ tipo: "Meta", identificador: "000000000000000", observacao: "" }] },
    { acessos: [{ contexto: "Acessos", rotulo: "Senha", valor: "SenhaFalsa123" }] },
  ];
  for (const patch of casos) {
    assert.equal(fichaVazia(ficha(patch)), false, JSON.stringify(patch));
  }
});

test("ficha montada a partir de lixo é vazia — normalizador e estado vazio concordam", () => {
  // A invariante entre as duas metades do módulo: se os normalizadores
  // jogaram tudo fora, a tela tem que dizer que não há nada. Uma lista de
  // três linhas em branco não pode virar "tem dado aqui".
  const brancos = [{ rotulo: "  ", destino: "" }, null, "lixo", { tipo: "   " }];
  assert.equal(
    fichaVazia(
      ficha({
        botoes: normalizarBotoes(brancos),
        pixels: normalizarPixels(brancos),
        acessos: normalizarAcessos(brancos),
      })
    ),
    true
  );
});
