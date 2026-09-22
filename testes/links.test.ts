import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairLinks } from "../src/lib/links-de-nota.ts";

/**
 * Chips de link nas observações da demanda. A regra: o chip tem que levar
 * ao endereço que a pessoa colou — nem mais, nem menos caractere.
 */

test("link markdown vira chip com o nome escrito", () => {
  const r = extrairLinks("Ver o [briefing da Ana](https://exemplo.fake/b/abc)");
  assert.deepEqual(r, [{ label: "briefing da Ana", url: "https://exemplo.fake/b/abc" }]);
});

test("URL solta também vira chip", () => {
  const r = extrairLinks("Material em https://drive.fake/pasta/123");
  assert.equal(r.length, 1);
  assert.equal(r[0].url, "https://drive.fake/pasta/123");
});

test("ponto final da frase não entra no endereço", () => {
  // "veja https://drive.fake/abc." — o ponto é da frase. Sem aparar, o
  // chip levava a um endereço que não existe.
  const r = extrairLinks("Veja https://drive.fake/abc.");
  assert.equal(r[0].url, "https://drive.fake/abc");
});

test("a mesma URL não vira dois chips", () => {
  const r = extrairLinks("https://a.fake/x e de novo https://a.fake/x");
  assert.equal(r.length, 1);
});

test("URL que já está dentro de um link markdown não duplica", () => {
  const r = extrairLinks("[pasta](https://drive.fake/p)");
  assert.equal(r.length, 1);
  assert.equal(r[0].label, "pasta");
});

test("texto sem link nenhum não gera chip", () => {
  assert.deepEqual(extrairLinks("Só uma observação qualquer."), []);
  assert.deepEqual(extrairLinks(""), []);
});
