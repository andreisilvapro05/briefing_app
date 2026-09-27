import { test } from "node:test";
import assert from "node:assert/strict";
import { datasEmSequencia, proximoDiaUtil } from "../src/lib/agendar-lote.ts";

// 2026-09-28 é uma segunda-feira; 2026-10-03 é sábado; 2026-10-04 domingo.

test("a primeira data é o próprio início, quando é dia útil", () => {
  assert.deepEqual(datasEmSequencia("2026-09-28", 1, 2), ["2026-09-28"]);
});

test("início no fim de semana vai pro próximo dia útil", () => {
  assert.equal(proximoDiaUtil("2026-10-03"), "2026-10-05");
  assert.equal(proximoDiaUtil("2026-10-04"), "2026-10-05");
  assert.equal(proximoDiaUtil("2026-09-28"), "2026-09-28");
  assert.deepEqual(datasEmSequencia("2026-10-03", 2, 1), ["2026-10-05", "2026-10-06"]);
});

test("o intervalo conta em dias ÚTEIS, pulando o fim de semana", () => {
  // Segunda + 2 úteis = quarta; + 2 = sexta; + 2 = terça da semana seguinte.
  assert.deepEqual(datasEmSequencia("2026-09-28", 4, 2), [
    "2026-09-28",
    "2026-09-30",
    "2026-10-02",
    "2026-10-06",
  ]);
});

test("intervalo 1 dá dias úteis consecutivos, sem cair no sábado", () => {
  assert.deepEqual(datasEmSequencia("2026-10-01", 4, 1), [
    "2026-10-01",
    "2026-10-02",
    "2026-10-05",
    "2026-10-06",
  ]);
});

test("intervalo 0 põe todas no mesmo dia", () => {
  assert.deepEqual(datasEmSequencia("2026-09-28", 3, 0), [
    "2026-09-28",
    "2026-09-28",
    "2026-09-28",
  ]);
});

test("intervalo negativo é tratado como 0, não anda pra trás", () => {
  assert.deepEqual(datasEmSequencia("2026-09-28", 2, -5), [
    "2026-09-28",
    "2026-09-28",
  ]);
});

test("quantidade zero ou negativa devolve lista vazia", () => {
  assert.deepEqual(datasEmSequencia("2026-09-28", 0, 2), []);
  assert.deepEqual(datasEmSequencia("2026-09-28", -3, 2), []);
});

test("data que não presta devolve vazio em vez de datas inválidas", () => {
  assert.equal(proximoDiaUtil("28/09/2026"), null);
  assert.deepEqual(datasEmSequencia("28/09/2026", 3, 2), []);
});

test("atravessa a virada de mês e de ano", () => {
  assert.deepEqual(datasEmSequencia("2026-12-30", 3, 1), [
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
  ]);
});

test("dez etapas a cada 2 dias úteis não caem em nenhum fim de semana", () => {
  const datas = datasEmSequencia("2026-09-28", 10, 2);
  assert.equal(datas.length, 10);
  for (const d of datas) {
    const dia = new Date(`${d}T12:00:00Z`).getUTCDay();
    assert.ok(dia !== 0 && dia !== 6, `${d} caiu no fim de semana`);
  }
});
