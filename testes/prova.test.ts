import { test } from "node:test";
import assert from "node:assert/strict";
import {
  depoimentoDe,
  faltaParaPublico,
  filtrarProvas,
  paresAntesDepois,
  podeUsarEm,
  problemaNaResposta,
  problemaNoResultado,
  TERMO_POR_NIVEL,
  valoresDe,
  type Prova,
  type ProofAsset,
} from "../src/lib/prova.ts";

const asset = (over: Partial<ProofAsset> = {}): ProofAsset => ({
  id: "a1",
  tipo: "depois",
  dispositivo: "desktop",
  capturadoEm: null,
  storagePath: "x/y.png",
  legenda: null,
  origem: "upload",
  ordem: 0,
  ...over,
});

const prova = (over: Partial<Prova> = {}): Prova => ({
  id: "p1",
  clientId: "c1",
  cliente: "Cliente",
  status: "a_coletar",
  segmento: null,
  servico: null,
  cidade: null,
  siteUrl: null,
  depoimentoTexto: null,
  depoimentoAudioPath: null,
  depoimentoTranscricao: null,
  nota: null,
  autorizacaoNivel: null,
  autorizacaoTermo: null,
  autorizadoPor: null,
  autorizadoEm: null,
  resultadoTexto: null,
  resultadoFonte: null,
  resultadoData: null,
  tags: [],
  usadoEm: [],
  conferidoPor: null,
  conferidoEm: null,
  criadoEm: "2026-10-05T12:00:00Z",
  atualizadoEm: "2026-10-05T12:00:00Z",
  assets: [],
  ...over,
});

/* ── "Resultado só com fonte e data" ──────────────────────────────────── */

test("número sem fonte não passa — é a regra central do PRD", () => {
  assert.match(
    problemaNoResultado({ texto: "3x mais leads", fonte: "", data: "2026-10-01" }) ?? "",
    /de onde veio/i
  );
});

test("número sem data não passa", () => {
  assert.match(
    problemaNoResultado({ texto: "3x mais leads", fonte: "Clarity", data: "" }) ?? "",
    /de quando/i
  );
});

test("resultado completo passa", () => {
  assert.equal(
    problemaNoResultado({
      texto: "3x mais leads",
      fonte: "Search Console",
      data: "2026-10-01",
    }),
    null
  );
});

test("apagar o resultado inteiro é sempre permitido", () => {
  // Campo vazio é melhor que número sem origem — então esvaziar não pode
  // ser bloqueado por "falta a fonte".
  assert.equal(problemaNoResultado({ texto: "", fonte: "", data: "" }), null);
  assert.equal(problemaNoResultado({ texto: "  ", fonte: " ", data: " " }), null);
});

test("fonte e data sem o número também não passam", () => {
  assert.match(
    problemaNoResultado({ texto: "", fonte: "Clarity", data: "2026-10-01" }) ?? "",
    /escreva o resultado/i
  );
});

test("data em formato torto é recusada", () => {
  assert.match(
    problemaNoResultado({ texto: "3x", fonte: "CRM", data: "01/10/2026" }) ?? "",
    /inválida/i
  );
});

/* ── "Nada sai como público sem nível registrado" ─────────────────────── */

test("sem autorização, nada pode — nem proposta", () => {
  for (const tipo of ["proposta", "pagina", "post", "anuncio"] as const) {
    assert.equal(podeUsarEm(null, tipo), false, tipo);
  }
});

test("nível 1 é só proposta interna", () => {
  assert.equal(podeUsarEm(1, "proposta"), true);
  assert.equal(podeUsarEm(1, "pagina"), false);
  assert.equal(podeUsarEm(1, "post"), false);
  assert.equal(podeUsarEm(1, "anuncio"), false);
});

test("nível 2 mostra o site, mas não vai pra anúncio", () => {
  assert.equal(podeUsarEm(2, "pagina"), true);
  assert.equal(podeUsarEm(2, "proposta"), true);
  assert.equal(podeUsarEm(2, "anuncio"), false);
});

test("nível 3 libera conteúdo público e anúncio", () => {
  for (const tipo of ["proposta", "pagina", "post", "anuncio"] as const) {
    assert.equal(podeUsarEm(3, tipo), true, tipo);
  }
});

test("o que falta pra ir a público é dito item a item", () => {
  assert.deepEqual(faltaParaPublico(prova()), [
    "autorização do cliente",
    "depoimento",
    "print do depois",
  ]);

  const quase = prova({
    autorizacaoNivel: 2,
    depoimentoTexto: "Adorei trabalhar com vocês",
    assets: [asset({ tipo: "depois" })],
  });
  assert.deepEqual(faltaParaPublico(quase), ["autorização de nível 3"]);

  const pronta = prova({
    autorizacaoNivel: 3,
    depoimentoTranscricao: "transcrito do áudio",
    assets: [asset({ tipo: "depois" })],
  });
  assert.deepEqual(faltaParaPublico(pronta), []);
});

/* ── Filtro da tela (critério de aceite do PRD) ───────────────────────── */

test("aprovadas para uso, nível 3, segmento saúde", () => {
  const provas = [
    prova({
      id: "certa",
      status: "aprovado_para_uso",
      autorizacaoNivel: 3,
      segmento: "saúde",
    }),
    prova({ id: "nivel-baixo", status: "aprovado_para_uso", autorizacaoNivel: 1, segmento: "saúde" }),
    prova({ id: "outro-segmento", status: "aprovado_para_uso", autorizacaoNivel: 3, segmento: "advocacia" }),
    prova({ id: "nao-aprovada", status: "coletado", autorizacaoNivel: 3, segmento: "saúde" }),
  ];
  const r = filtrarProvas(provas, {
    status: "aprovado_para_uso",
    nivel: "3",
    segmento: "saúde",
  });
  assert.deepEqual(r.map((p) => p.id), ["certa"]);
});

test('filtro "sem autorização" acha o que ninguém autorizou', () => {
  const provas = [prova({ id: "a" }), prova({ id: "b", autorizacaoNivel: 2 })];
  assert.deepEqual(
    filtrarProvas(provas, { nivel: "sem" }).map((p) => p.id),
    ["a"]
  );
});

test("filtro vazio devolve tudo", () => {
  const provas = [prova({ id: "a" }), prova({ id: "b" })];
  assert.equal(filtrarProvas(provas, {}).length, 2);
});

test("o filtro só oferece valores que existem", () => {
  const provas = [
    prova({ segmento: "saúde" }),
    prova({ segmento: "advocacia" }),
    prova({ segmento: "saúde" }),
    prova({ segmento: "   " }),
    prova({ segmento: null }),
  ];
  assert.deepEqual(valoresDe(provas, "segmento"), ["advocacia", "saúde"]);
});

/* ── Antes e depois ───────────────────────────────────────────────────── */

test("antes e depois pareados por dispositivo", () => {
  const pares = paresAntesDepois([
    asset({ id: "ad", tipo: "antes", dispositivo: "desktop" }),
    asset({ id: "dd", tipo: "depois", dispositivo: "desktop" }),
    asset({ id: "dc", tipo: "depois", dispositivo: "celular" }),
  ]);
  const desktop = pares.find((p) => p.dispositivo === "desktop")!;
  assert.equal(desktop.antes?.id, "ad");
  assert.equal(desktop.depois?.id, "dd");

  // Só o depois do celular: o par existe pela metade e a tela mostra o
  // buraco em vez de esconder a linha inteira.
  const celular = pares.find((p) => p.dispositivo === "celular")!;
  assert.equal(celular.antes, null);
  assert.equal(celular.depois?.id, "dc");
});

/* ── Depoimento ───────────────────────────────────────────────────────── */

test("o depoimento escrito ganha da transcrição do áudio", () => {
  assert.equal(
    depoimentoDe(prova({ depoimentoTexto: "escrito", depoimentoTranscricao: "ditado" })),
    "escrito"
  );
  assert.equal(
    depoimentoDe(prova({ depoimentoTexto: "   ", depoimentoTranscricao: "ditado" })),
    "ditado"
  );
  assert.equal(depoimentoDe(prova()), null);
});

/* ── A resposta do cliente ────────────────────────────────────────────── */

test("sem nível, a resposta do cliente não vale", () => {
  assert.match(
    problemaNaResposta({ depoimento: "adorei", nota: "10", nivel: "" }) ?? "",
    /até onde/i
  );
  assert.match(
    problemaNaResposta({ depoimento: "adorei", nota: "10", nivel: "9" }) ?? "",
    /até onde/i
  );
});

test("depoimento vazio é resposta legítima — o nível é que importa", () => {
  // Há cliente que autoriza mostrar o site e não quer escrever nada.
  assert.equal(
    problemaNaResposta({ depoimento: "", nota: "", nivel: "2" }),
    null
  );
});

test("nota fora de 0 a 10 é recusada, e vazia é aceita", () => {
  assert.equal(problemaNaResposta({ depoimento: "x", nota: "", nivel: "1" }), null);
  assert.equal(problemaNaResposta({ depoimento: "x", nota: "0", nivel: "1" }), null);
  assert.equal(problemaNaResposta({ depoimento: "x", nota: "10", nivel: "1" }), null);
  assert.match(
    problemaNaResposta({ depoimento: "x", nota: "11", nivel: "1" }) ?? "",
    /0 a 10/
  );
  assert.match(
    problemaNaResposta({ depoimento: "x", nota: "7.5", nivel: "1" }) ?? "",
    /0 a 10/
  );
});

test("cada nível tem um termo próprio, e o nível 3 fala de anúncio", () => {
  for (const n of [1, 2, 3] as const) {
    assert.ok(TERMO_POR_NIVEL[n].length > 40, `nível ${n} sem termo`);
  }
  assert.match(TERMO_POR_NIVEL[3], /an[úu]ncio/i);
  assert.match(TERMO_POR_NIVEL[1], /proposta/i);
});
