import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataValida,
  formatDataCompleta,
  formatDataCurta,
  formatDiaMes,
  formatDiaMesCurto,
  dataEmLinguagem,
} from "../src/lib/datas.ts";

/**
 * A regra que estas verificações protegem: prazo gravado torto tem que
 * aparecer COMO VEIO, nunca como "Invalid Date".
 *
 * `new Date("nao-e-data")` não lança — devolve uma data inválida, e
 * `toLocaleDateString` nela devolve a string literal "Invalid Date". Havia
 * quatro try/catch pelo app que por isso não protegiam nada.
 */

test("formata o prazo normal", () => {
  assert.equal(formatDiaMes("2026-09-21"), "21 set");
  assert.equal(formatDiaMesCurto("2026-09-24"), "24/09");
  assert.equal(formatDataCurta("2026-09-21"), "21/09/26");
  assert.equal(formatDataCompleta("2026-09-21"), "21/09/2026");
});

test("data inválida volta como veio, nunca como 'Invalid Date'", () => {
  for (const cru of ["nao-e-data", "2026-13-45", "abc", "Invalid"]) {
    for (const f of [formatDiaMes, formatDiaMesCurto, formatDataCurta, formatDataCompleta]) {
      assert.equal(f(cru), cru, `${f.name}("${cru}")`);
    }
  }
});

test("vazio continua vazio", () => {
  assert.equal(formatDiaMes(""), "");
  assert.equal(dataValida(""), null);
});

test("meio-dia UTC: o último dia do ano não vira o primeiro do seguinte", () => {
  assert.equal(formatDiaMes("2026-12-31"), "31 dez");
  assert.equal(formatDataCompleta("2026-01-01"), "01/01/2026");
});

test("dataValida separa data de lixo", () => {
  assert.notEqual(dataValida("2026-09-21"), null);
  assert.equal(dataValida("xxx"), null);
});

// ── data em linguagem ────────────────────────────────────────────────
// 2026-09-28 é uma segunda-feira.
test("hoje, amanhã e ontem saem por extenso", () => {
  assert.equal(dataEmLinguagem("2026-09-28", "2026-09-28"), "hoje");
  assert.equal(dataEmLinguagem("2026-09-29", "2026-09-28"), "amanhã");
  assert.equal(dataEmLinguagem("2026-09-27", "2026-09-28"), "ontem");
});

test("passado recente vira 'há N dias'", () => {
  assert.equal(dataEmLinguagem("2026-09-23", "2026-09-28"), "há 5 dias");
});

test("dentro da semana, o nome do dia diz mais que a data", () => {
  assert.equal(dataEmLinguagem("2026-09-30", "2026-09-28"), "quarta");
  assert.equal(dataEmLinguagem("2026-10-02", "2026-09-28"), "sexta");
});

test("longe demais volta a ser data — nome de dia confundiria", () => {
  assert.equal(dataEmLinguagem("2026-10-20", "2026-09-28"), "20/10");
  assert.equal(dataEmLinguagem("2026-07-01", "2026-09-28"), "01/07");
});

test("sem data e data inválida não quebram", () => {
  assert.equal(dataEmLinguagem(null, "2026-09-28"), "—");
  assert.equal(dataEmLinguagem("28/09/2026", "2026-09-28"), "28/09/2026");
});
