import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acimaDoLimite,
  MAX_UPLOAD_BYTES,
  novoPagamentoPago,
} from "../src/lib/uploads.ts";

test("o teto do app fica abaixo do limite de transporte da Vercel", () => {
  // Igualar os dois cria faixa cega: passa na nossa validação e morre no
  // transporte, sem mensagem. A folga é o que faz a recusa ser NOSSA.
  const BODY_SIZE_LIMIT = 4 * 1024 * 1024;
  assert.ok(
    MAX_UPLOAD_BYTES < BODY_SIZE_LIMIT,
    "MAX_UPLOAD_BYTES precisa ser menor que o bodySizeLimit do next.config"
  );
});

test("acimaDoLimite decide na borda", () => {
  assert.ok(!acimaDoLimite(MAX_UPLOAD_BYTES));
  assert.ok(acimaDoLimite(MAX_UPLOAD_BYTES + 1));
  assert.ok(!acimaDoLimite(0));
});

test("apagar comprovante DEVOLVE o valor — o total desce", () => {
  // 1000 gravados, 1000 em comprovantes; apaga um de 400.
  assert.equal(novoPagamentoPago(1000, 1000, 600), 600);
});

test("lançamento antigo sem comprovante não some no caminho", () => {
  // 1000 gravados, dos quais 300 vieram de comprovante: 700 são manuais.
  // Some um comprovante de 200 → 700 manuais + 500 de recibo.
  assert.equal(novoPagamentoPago(1000, 300, 500), 1200);
  // E apagar o de 300 devolve só ele, preservando os 700 manuais.
  assert.equal(novoPagamentoPago(1000, 300, 0), 700);
});

test("adicionar comprovante soma, sem duplicar o que já havia", () => {
  assert.equal(novoPagamentoPago(0, 0, 500), 500);
  assert.equal(novoPagamentoPago(500, 500, 900), 900);
});

test("cliente dessincronizado não vira dívida negativa", () => {
  // Gravado MENOR que a soma dos comprovantes: a parcela manual é zero.
  assert.equal(novoPagamentoPago(100, 500, 500), 500);
  assert.ok(novoPagamentoPago(0, 900, 0) >= 0);
});

test("centavos não acumulam sujeira de float", () => {
  assert.equal(novoPagamentoPago(0.3, 0.2, 0.2), 0.3);
  assert.equal(novoPagamentoPago(10.1, 0, 0.2), 10.3);
});
