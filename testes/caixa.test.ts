import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarCaixaDoMes,
  recebimentosDeCobrancas,
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

// ── recebido_em: quando o dinheiro CAI, não quando o cliente paga ──────

const rr = (
  valor: number,
  pago_em: string,
  recebido_em: string | null,
  forma = "cartao"
) => ({ valor, pago_em, recebido_em, forma });

test("o caixa conta pela data em que CAIU, não pela da compra", () => {
  const movs = [rr(1000, "2026-09-20", "2026-10-15")];
  assert.equal(montarCaixaDoMes(movs, [], "2026-09").entrou, 0);
  assert.equal(montarCaixaDoMes(movs, [], "2026-10").entrou, 1000);
});

test("sem recebido_em, vale a data do pagamento — pix e boleto", () => {
  const c = montarCaixaDoMes([rr(800, "2026-09-05", null, "pix")], [], "2026-09");
  assert.equal(c.entrou, 800);
});

test("a compra do mês que cai depois vira 'a receber', e não some", () => {
  const c = montarCaixaDoMes(
    [rr(2000, "2026-09-20", "2026-10-15"), rr(500, "2026-09-03", null, "pix")],
    [],
    "2026-09"
  );
  assert.equal(c.entrou, 500);
  assert.equal(c.aReceber, 2000);
  assert.equal(c.quantidadeAReceber, 1);
});

test("queda no mesmo mês da compra não é 'a receber'", () => {
  const c = montarCaixaDoMes([rr(700, "2026-09-02", "2026-09-28")], [], "2026-09");
  assert.equal(c.entrou, 700);
  assert.equal(c.aReceber, 0);
});

test("queda ANTES da compra não vira a receber negativo", () => {
  const c = montarCaixaDoMes([rr(700, "2026-09-20", "2026-09-01")], [], "2026-09");
  assert.equal(c.aReceber, 0);
});

test("os meses listados incluem o da compra e o da queda", () => {
  assert.deepEqual(
    mesesComEntrada([{ pago_em: "2026-09-20", recebido_em: "2026-11-15" }]),
    ["2026-11", "2026-09"]
  );
});

test("a quebra por forma segue o mês em que caiu", () => {
  const c = montarCaixaDoMes(
    [rr(3000, "2026-09-10", "2026-10-10"), rr(1000, "2026-10-02", null, "pix")],
    [],
    "2026-10"
  );
  assert.deepEqual(
    c.porForma.map((f) => `${f.rotulo}:${f.total}`),
    ["Cartão:3000", "Pix:1000"]
  );
});

test("a mensalidade recebida entra no caixa do mês", () => {
  // O caixa lia só o pagamento do PROJETO: a receita recorrente (SEO,
  // manutenção) ficava fora, e o mês fechava faltando justamente o que
  // entra todo mês. Karine (26/09): "cruzar o caixa completo".
  const deCobrancas = recebimentosDeCobrancas([
    {
      historico: [
        { valorPago: 1000, pagoEm: "2026-09-23T12:00:00.000Z", forma: "pix" },
        { valorPago: 400, pagoEm: "2026-08-10", forma: "boleto" },
      ],
    },
  ]);
  assert.equal(deCobrancas.length, 2);
  assert.equal(deCobrancas[0].pago_em, "2026-09-23", "corta a hora do ISO");

  const caixa = montarCaixaDoMes(
    [{ valor: 500, pago_em: "2026-09-05", forma: "pix" }, ...deCobrancas],
    [],
    "2026-09"
  );
  assert.equal(caixa.entrou, 1500, "500 do projeto + 1000 da mensalidade");
  assert.equal(caixa.porForma.find((f) => f.forma === "pix")?.quantidade, 2);
});

test("cobrança sem histórico, ou com registro torto, não quebra o caixa", () => {
  assert.deepEqual(recebimentosDeCobrancas([{ historico: null }]), []);
  assert.deepEqual(recebimentosDeCobrancas([{}]), []);
  assert.deepEqual(
    recebimentosDeCobrancas([{ historico: [{ valorPago: 10, pagoEm: "", forma: null }] }]),
    [],
    "registro sem data não entra em mês nenhum"
  );
});
