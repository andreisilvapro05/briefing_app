import { test } from "node:test";
import assert from "node:assert/strict";
import { montarAReceber, type ProjetoPendente } from "../src/lib/a-receber.ts";
import type { CobrancaMensal } from "../src/lib/cobrancas-mensais.ts";

const proj = (over: Partial<ProjetoPendente> = {}): ProjetoPendente => ({
  id: "p1",
  nome: "Fulano",
  empresa: "Empresa Fulano",
  whatsapp: null,
  pagamento_total: 1000,
  pagamento_pago: 400,
  pagamento_observacao: null,
  ...over,
});

const cob = (over: Partial<CobrancaMensal> = {}): CobrancaMensal =>
  ({
    id: "c1",
    client_id: null,
    nome: "Carla",
    empresa: null,
    whatsapp: null,
    email: null,
    valor_mensal: 1000,
    dia_cobranca: 10,
    descricao: "SEO",
    ativa: true,
    data_inicio: "2026-01-01",
    data_fim: null,
    historico: [],
    tipo: "mensal",
    data_vencimento: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...over,
  }) as CobrancaMensal;

// Dia 20: já passou do dia 10 de cobrança.
const DIA_20 = new Date(2026, 8, 20);

test("junta saldo de projeto e mensalidade em aberto numa lista só", () => {
  const r = montarAReceber([proj()], [cob()], DIA_20);
  assert.equal(r.linhas.length, 2);
  assert.deepEqual(
    r.linhas.map((l) => l.origem).sort(),
    ["projeto", "recorrente"]
  );
  assert.equal(r.total, 1600, "600 do projeto + 1000 da mensalidade");
});

test("o atrasado vem primeiro, mesmo valendo menos", () => {
  const r = montarAReceber(
    [proj({ pagamento_total: 9000, pagamento_pago: 0 })],
    [cob({ valor_mensal: 100 })],
    DIA_20
  );
  assert.equal(r.linhas[0].origem, "recorrente");
  assert.equal(r.linhas[0].atrasado, true);
  assert.equal(r.atrasados, 1);
});

test("mensalidade já paga no mês não entra no aviso", () => {
  const pago = cob({
    historico: [
      {
        id: "h1",
        mesReferencia: "2026-09",
        valorPago: 1000,
        pagoEm: "2026-09-12",
        forma: "pix",
        observacao: "",
      },
    ],
  });
  const r = montarAReceber([], [pago], DIA_20);
  assert.deepEqual(r.linhas, []);
  assert.equal(r.total, 0);
});

test("cobrança inativa não cobra ninguém", () => {
  const r = montarAReceber([], [cob({ ativa: false })], DIA_20);
  assert.deepEqual(r.linhas, []);
});

test("projeto quitado sai da lista, e centavo de arredondamento não é dívida", () => {
  const r = montarAReceber(
    [
      proj({ id: "quitado", pagamento_pago: 1000 }),
      proj({ id: "centavo", pagamento_total: 1000, pagamento_pago: 999.995 }),
    ],
    [],
    DIA_20
  );
  assert.deepEqual(r.linhas, []);
});

test("saldo de projeto nunca é marcado como atrasado", () => {
  // O sistema não guarda prazo do saldo de projeto — dizer "atrasado"
  // seria inventar uma data que ninguém combinou.
  const r = montarAReceber([proj()], [], DIA_20);
  assert.equal(r.linhas[0].atrasado, false);
  assert.equal(r.atrasados, 0);
});

test("pontual sem pagamento e vencida conta como atrasada", () => {
  const pontual = cob({
    id: "c2",
    tipo: "pontual",
    data_vencimento: "2026-09-01",
    valor_mensal: 500,
  });
  const r = montarAReceber([], [pontual], DIA_20);
  assert.equal(r.linhas[0].atrasado, true);
  assert.equal(r.linhas[0].falta, 500);
});

test("a chave distingue projeto de cobrança que tenham o mesmo id", () => {
  const r = montarAReceber([proj({ id: "x" })], [cob({ id: "x" })], DIA_20);
  assert.equal(new Set(r.linhas.map((l) => l.chave)).size, 2);
});

test("empresa manda no nome; sem empresa, fica o nome da pessoa", () => {
  const r = montarAReceber(
    [proj({ empresa: "  " })],
    [cob({ empresa: "Cma Conecta" })],
    DIA_20
  );
  const nomes = r.linhas.map((l) => l.nome);
  assert.ok(nomes.includes("Fulano"));
  assert.ok(nomes.includes("Cma Conecta"));
});
