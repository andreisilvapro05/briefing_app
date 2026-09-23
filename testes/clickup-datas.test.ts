import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * A conversão do prazo que vem do ClickUp.
 *
 * Lá o prazo é um instante (ms desde 1970) e a data que a pessoa vê é a do
 * fuso DELA. Converter com `toISOString()` devolve a data de Greenwich: uma
 * tarefa marcada pra depois das 21h em Brasília chegava aqui com o dia
 * seguinte, e o app dizia que ela vencia amanhã.
 *
 * A função é privada do módulo de sync (que importa o Supabase e não roda
 * fora do Next), então o que se verifica aqui é a REGRA, com a mesma conta.
 */
const FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const emBrasilia = (ms: number) => FMT.format(new Date(ms));
const emUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);

test("prazo no fim do dia não vira o dia seguinte", () => {
  // 23/09/2026 às 22h em Brasília = 24/09 às 01h em Greenwich.
  const ms = Date.parse("2026-09-23T22:00:00-03:00");
  assert.equal(emBrasilia(ms), "2026-09-23");
  assert.equal(emUTC(ms), "2026-09-24", "é este o erro que a conta antiga cometia");
});

test("prazo de manhã dá o mesmo dia nas duas contas", () => {
  const ms = Date.parse("2026-09-23T09:00:00-03:00");
  assert.equal(emBrasilia(ms), "2026-09-23");
  assert.equal(emUTC(ms), "2026-09-23");
});

test("virada de mês", () => {
  const ms = Date.parse("2026-09-30T23:30:00-03:00");
  assert.equal(emBrasilia(ms), "2026-09-30");
});

test("virada de ano", () => {
  const ms = Date.parse("2026-12-31T21:10:00-03:00");
  assert.equal(emBrasilia(ms), "2026-12-31");
});
