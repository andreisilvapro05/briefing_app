import { test } from "node:test";
import assert from "node:assert/strict";
import { reordenarComInsercao } from "../src/lib/ordem-tarefas.ts";

test("insere logo depois da referência numa lista bem-comportada", () => {
  const r = reordenarComInsercao(
    [
      { id: "a", ordem: 0 },
      { id: "b", ordem: 1 },
      { id: "c", ordem: 2 },
    ],
    "a"
  );
  assert.ok(r);
  assert.equal(r.ordemNova, 1);
  // "a" fica em 0; b e c descem uma casa.
  assert.deepEqual(r.mover, [
    { id: "b", ordem: 2 },
    { id: "c", ordem: 3 },
  ]);
});

test("inserir depois da última não move ninguém", () => {
  const r = reordenarComInsercao(
    [
      { id: "a", ordem: 0 },
      { id: "b", ordem: 1 },
    ],
    "b"
  );
  assert.ok(r);
  assert.equal(r.ordemNova, 2);
  assert.deepEqual(r.mover, []);
});

test("referência que não existe devolve null (não inventa posição)", () => {
  const r = reordenarComInsercao([{ id: "a", ordem: 0 }], "apagada");
  assert.equal(r, null);
});

test("renumera ordem com buracos — o seed e o sync deixam a lista assim", () => {
  const r = reordenarComInsercao(
    [
      { id: "a", ordem: 5 },
      { id: "b", ordem: 9 },
      { id: "c", ordem: 40 },
    ],
    "b"
  );
  assert.ok(r);
  assert.equal(r.ordemNova, 2);
  assert.deepEqual(r.mover, [
    { id: "a", ordem: 0 },
    { id: "b", ordem: 1 },
    { id: "c", ordem: 3 },
  ]);
});

test("ordem repetida: desempata pela posição que o banco devolveu", () => {
  // Três tarefas empatadas em 0 — acontece quando o seed grava o checklist
  // inteiro de uma vez. Sem desempate estável, a tarefa nova nasceria
  // acima ou abaixo por sorte.
  const r = reordenarComInsercao(
    [
      { id: "a", ordem: 0 },
      { id: "b", ordem: 0 },
      { id: "c", ordem: 0 },
    ],
    "b"
  );
  assert.ok(r);
  assert.equal(r.ordemNova, 2);
  assert.deepEqual(r.mover, [
    { id: "b", ordem: 1 },
    { id: "c", ordem: 3 },
  ]);
});

test("lista de uma só tarefa", () => {
  const r = reordenarComInsercao([{ id: "a", ordem: 0 }], "a");
  assert.ok(r);
  assert.equal(r.ordemNova, 1);
  assert.deepEqual(r.mover, []);
});

test("lista vazia não casa com nada", () => {
  assert.equal(reordenarComInsercao([], "a"), null);
});
