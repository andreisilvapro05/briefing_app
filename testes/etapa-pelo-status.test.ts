import { test } from "node:test";
import assert from "node:assert/strict";
import {
  etapaDoCliente,
  indiceNaLinhaDoTempo,
} from "../src/lib/etapa-pelo-status.ts";

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
