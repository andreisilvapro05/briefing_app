import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarCaixaDoMes,
  mesesComEntrada,
  competenciaDe,
  rotuloDaForma,
  rotuloDoMes,
} from "../src/lib/caixa.ts";

const r = (valor: number | string | null, pago_em: string | null, forma: string | null) => ({
  valor, pago_em, forma,
});

test("soma o mês e quebra por forma, da maior pra menor", () => {
  const c = montarCaixaDoMes(
    [
      r(1000, "2026-09-03", "pix"),
      r(2500, "2026-09-10", "cartao"),
      r(500, "2026-09-20", "pix"),
      r(9999, "2026-08-01", "pix"),
    ],
    [],
    "2026-09"
  );
  assert.equal(c.entrou, 4000);
  assert.equal(c.quantidade, 3);
  assert.deepEqual(
    c.porForma.map((f) => `${f.rotulo}:${f.total}:${f.quantidade}`),
    ["Cartão:2500:1", "Pix:1500:2"]
  );
});

test("mês sem nada não quebra e devolve zero", () => {
  const c = montarCaixaDoMes([r(100, "2026-09-01", "pix")], [], "2026-10");
  assert.equal(c.entrou, 0);
  assert.equal(c.quantidade, 0);
  assert.deepEqual(c.porForma, []);
  assert.equal(c.sobrou, 0);
});

test("valor em texto e valor nulo não viram NaN", () => {
  const c = montarCaixaDoMes(
    [r("1500.50", "2026-09-01", "pix"), r(null, "2026-09-02", "pix")],
    [],
    "2026-09"
  );
  assert.equal(c.entrou, 1500.5);
  assert.equal(c.quantidade, 2);
});

test("forma vazia vira 'Não informada' e ainda soma", () => {
  const c = montarCaixaDoMes([r(300, "2026-09-01", "  ")], [], "2026-09");
  assert.equal(c.entrou, 300);
  assert.equal(c.porForma[0].rotulo, "Não informada");
});

test("forma desconhecida aparece com o valor cru, não some", () => {
  const c = montarCaixaDoMes([r(300, "2026-09-01", "cripto")], [], "2026-09");
  assert.equal(c.porForma[0].rotulo, "cripto");
});

test("custo da competência entra no que saiu e no que sobrou", () => {
  const c = montarCaixaDoMes(
    [r(5000, "2026-09-01", "pix")],
    [{ valor: 1200, competencia: "2026-09" }, { valor: 999, competencia: "2026-08" }],
    "2026-09"
  );
  assert.equal(c.saiu, 1200);
  assert.equal(c.sobrou, 3800);
});

test("data que não presta não entra em mês nenhum", () => {
  assert.equal(competenciaDe("31/12/2026"), null);
  assert.equal(competenciaDe(null), null);
  assert.equal(competenciaDe("2026-09-03"), "2026-09");
  const c = montarCaixaDoMes([r(100, "31/12/2026", "pix")], [], "2026-12");
  assert.equal(c.quantidade, 0);
});

test("lista os meses com entrada, do mais novo pro mais antigo", () => {
  assert.deepEqual(
    mesesComEntrada([
      { pago_em: "2026-07-01" },
      { pago_em: "2026-09-15" },
      { pago_em: "2026-09-02" },
      { pago_em: null },
    ]),
    ["2026-09", "2026-07"]
  );
});

test("rótulos em português", () => {
  assert.equal(rotuloDaForma("cartao"), "Cartão");
  assert.equal(rotuloDaForma(null), "Não informada");
  assert.equal(rotuloDoMes("2026-09"), "setembro de 2026");
  assert.equal(rotuloDoMes("2026-13"), "2026-13");
  assert.equal(rotuloDoMes("xx"), "xx");
});
