import { test } from "node:test";
import assert from "node:assert/strict";
import {
  etapaDoCliente,
  indiceNaLinhaDoTempo,
} from "../src/lib/etapa-pelo-status.ts";
import {
  buildTimeline,
  ehProjectTypeConhecido,
  maxStageIndexDe,
  PROJECT_TYPE_OPTIONS,
} from "../src/lib/project-types.ts";

const LP = [
  "Onboarding",
  "Criação da copy",
  "Prévia visual no Figma",
  "Ajustes",
  "Implementação e otimização",
  "Documento de entrega",
];

test("o status do quadro decide a etapa que o cliente vê", () => {
  assert.equal(etapaDoCliente("onboarding"), "onboarding");
  assert.equal(etapaDoCliente("redacao-copy"), "copy");
  assert.equal(etapaDoCliente("design-pagina"), "design");
  assert.equal(etapaDoCliente("implementacao"), "implementacao");
  assert.equal(etapaDoCliente("completo-entregue"), "entrega");
});

test("projeto parado não anda pro cliente", () => {
  assert.equal(etapaDoCliente("parado"), "onboarding");
});

test("status desconhecido ou nulo cai no começo, não quebra", () => {
  assert.equal(etapaDoCliente(null), "onboarding");
  assert.equal(etapaDoCliente("inventado"), "onboarding");
});

test("casa pelo título da etapa, não pela posição", () => {
  assert.equal(indiceNaLinhaDoTempo("redacao-copy", LP), 1);
  assert.equal(indiceNaLinhaDoTempo("design-pagina", LP), 2);
  assert.equal(indiceNaLinhaDoTempo("ajustes-design-copy", LP), 3);
  assert.equal(indiceNaLinhaDoTempo("otimizacao-entrega", LP), 5);
});

test("'Design de múltiplas páginas' também casa com design", () => {
  const site = ["Onboarding", "Criação da copy", "Prévia visual completa do site"];
  assert.equal(indiceNaLinhaDoTempo("design-pagina", site), 2);
});

test("linha do tempo sem etapa equivalente cai em proporção", () => {
  // SEO: auditoria e estratégia no lugar de copy e design.
  const seo = ["Onboarding", "Auditoria SEO", "Estratégia", "Otimização on-page"];
  const i = indiceNaLinhaDoTempo("design-pagina", seo);
  assert.ok(i > 0 && i < seo.length, `caiu fora: ${i}`);
});

test("nunca volta atrás do que alguém avançou na mão", () => {
  assert.equal(indiceNaLinhaDoTempo("onboarding", LP, 4), 4);
  // Mas o status pode passar à frente do manual.
  assert.equal(indiceNaLinhaDoTempo("otimizacao-entrega", LP, 1), 5);
});

test("nunca estoura o fim da lista", () => {
  assert.equal(indiceNaLinhaDoTempo("completo-entregue", LP, 99), LP.length - 1);
});

test("lista vazia devolve o manual, sem quebrar", () => {
  assert.equal(indiceNaLinhaDoTempo("design-pagina", [], 2), 2);
  assert.equal(indiceNaLinhaDoTempo("design-pagina", []), 0);
});

/* ── Tipo de projeto: tráfego (04/10) ──────────────────────────────── */

test("tráfego é um tipo que o app conhece — era o que travava a Carla", () => {
  // `trafego` existia no union e no CHECK do banco desde 28/09, mas não em
  // PROJECT_TYPE_OPTIONS: o painel não reconhecia o tipo e devolvia a
  // cliente pra tela de escolha, que a mandava de volta. Loop eterno.
  assert.equal(ehProjectTypeConhecido("trafego"), true);
  assert.equal(ehProjectTypeConhecido("nao-existe"), false);
});

test("tráfego tem timeline própria, não a de landing", () => {
  const t = buildTimeline("trafego", 0);
  const titulos = t.map((e) => e.titulo);
  assert.equal(titulos[0], "Onboarding");
  assert.ok(titulos.includes("Veiculação e otimização"));
  // O serviço é contínuo: não tem prévia no Figma nem documento de entrega.
  assert.ok(!titulos.includes("Prévia visual no Figma"));
  assert.ok(!titulos.includes("Documento de entrega"));
});

test("o limite de etapa sai da própria timeline, para todo tipo", () => {
  // Estava escrito à mão em três lugares e os três diziam 5 pra qualquer
  // tipo fora de landing-sem-copy/outro — então tráfego (5 etapas) ganhava
  // limite 5 e o painel podia marcar TUDO como concluído.
  for (const tipo of PROJECT_TYPE_OPTIONS.map((o) => o.id)) {
    assert.equal(
      maxStageIndexDe(tipo),
      buildTimeline(tipo, 0).length - 1,
      tipo
    );
  }
});
