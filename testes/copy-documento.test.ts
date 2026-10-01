import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COPY_LABEL,
  COPY_PROXIMO_PASSO,
  COPY_TOM,
  situacaoDaCopy,
  type SituacaoCopy,
} from "../src/lib/copy-documento.ts";

const e = (over: Partial<Parameters<typeof situacaoDaCopy>[0]> = {}) => ({
  shareEnabled: false,
  aprovadoEm: null,
  ajustePedidoEm: null,
  ...over,
});

test("sem link e sem resposta é rascunho; com link, está com o cliente", () => {
  assert.equal(situacaoDaCopy(e()), "rascunho");
  assert.equal(situacaoDaCopy(e({ shareEnabled: true })), "aguardando");
});

test("aprovada e ajuste pedido valem mesmo com o link já revogado", () => {
  // Revogar o link depois não pode apagar a resposta que o cliente deu.
  assert.equal(
    situacaoDaCopy(e({ aprovadoEm: "2026-09-30T10:00:00Z" })),
    "aprovada"
  );
  assert.equal(
    situacaoDaCopy(e({ ajustePedidoEm: "2026-09-30T10:00:00Z" })),
    "ajuste-pedido"
  );
});

test("a resposta MAIS RECENTE manda — segunda rodada volta pra ajuste", () => {
  assert.equal(
    situacaoDaCopy(
      e({
        aprovadoEm: "2026-09-28T10:00:00Z",
        ajustePedidoEm: "2026-09-30T10:00:00Z",
      })
    ),
    "ajuste-pedido"
  );
  // E aprovar depois de pedir ajuste fecha de novo.
  assert.equal(
    situacaoDaCopy(
      e({
        aprovadoEm: "2026-10-01T10:00:00Z",
        ajustePedidoEm: "2026-09-30T10:00:00Z",
      })
    ),
    "aprovada"
  );
});

test("data torta não derruba a tela nem inventa aprovação", () => {
  assert.equal(situacaoDaCopy(e({ aprovadoEm: "nem é data" })), "rascunho");
  assert.equal(
    situacaoDaCopy(e({ aprovadoEm: "", ajustePedidoEm: "", shareEnabled: true })),
    "aguardando"
  );
});

test("toda situação tem rótulo, tom e próximo passo", () => {
  const todas: SituacaoCopy[] = [
    "rascunho",
    "aguardando",
    "ajuste-pedido",
    "aprovada",
  ];
  for (const s of todas) {
    assert.ok(COPY_LABEL[s], `${s} sem rótulo`);
    assert.match(COPY_TOM[s], /bg-/, `${s} sem tom`);
    assert.ok(COPY_PROXIMO_PASSO[s].length > 10, `${s} sem próximo passo`);
  }
  // Pedido de ajuste é trabalho, não erro: nada de vermelho.
  assert.ok(!COPY_TOM["ajuste-pedido"].includes("red-"));
});
