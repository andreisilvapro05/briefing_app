import { test } from "node:test";
import assert from "node:assert/strict";
import { proximaOcorrencia } from "../src/lib/project-tasks.ts";

/**
 * Demanda interna que se repete. A próxima ocorrência nasce quando a atual
 * é concluída, e a data conta do VENCIMENTO da anterior — não de hoje —
 * pra a série não escorregar pra frente a cada atraso.
 */
const HOJE = "2026-09-22";

test("cada cadência avança o que promete", () => {
  assert.equal(proximaOcorrencia("diaria", "2026-09-22", HOJE), "2026-09-23");
  assert.equal(proximaOcorrencia("semanal", "2026-09-22", HOJE), "2026-09-29");
  assert.equal(proximaOcorrencia("quinzenal", "2026-09-22", HOJE), "2026-10-07");
  assert.equal(proximaOcorrencia("mensal", "2026-09-22", HOJE), "2026-10-22");
});

test("semanal atrasada mantém o dia da semana", () => {
  // Vencida em 01/09 (terça) e concluída em 22/09: a próxima é a terça
  // seguinte a hoje, não "hoje + 7".
  assert.equal(proximaOcorrencia("semanal", "2026-09-01", HOJE), "2026-09-29");
});

test("nunca devolve data no passado nem hoje", () => {
  for (const c of ["diaria", "semanal", "quinzenal", "mensal"]) {
    const r = proximaOcorrencia(c, "2025-01-01", HOJE);
    assert.ok(r !== null && r > HOJE, `${c} devolveu ${r}`);
  }
});

test("mês que não tem o dia cai no último, não pula pro seguinte", () => {
  // new Date(2026, 1, 31) viraria 3 de março — a demanda de fim de mês
  // pularia pro começo do outro.
  assert.equal(proximaOcorrencia("mensal", "2026-01-31", "2026-01-31"), "2026-02-28");
  assert.equal(proximaOcorrencia("mensal", "2026-03-31", "2026-03-31"), "2026-04-30");
});

test("atravessa a virada de ano", () => {
  assert.equal(proximaOcorrencia("mensal", "2026-12-31", "2026-12-31"), "2027-01-31");
  assert.equal(proximaOcorrencia("semanal", "2026-12-30", "2026-12-30"), "2027-01-06");
});

test("sem vencimento, a série começa a partir de hoje", () => {
  assert.equal(proximaOcorrencia("semanal", null, HOJE), "2026-09-29");
  assert.equal(proximaOcorrencia("semanal", "nao-e-data", HOJE), "2026-09-29");
});

test("cadência que não existe não gera nada", () => {
  assert.equal(proximaOcorrencia("anual", "2026-09-22", HOJE), null);
  assert.equal(proximaOcorrencia("", "2026-09-22", HOJE), null);
});
