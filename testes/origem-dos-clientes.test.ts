import { test } from "node:test";
import assert from "node:assert/strict";
import {
  celulaCSV,
  diaBrasilia,
  diasEntre,
  montarCSV,
  montarLinhas,
  resumirPorOrigem,
  SEM_ORIGEM,
  type ClienteParaOrigem,
} from "../src/lib/origem-dos-clientes.ts";

const cli = (over: Partial<ClienteParaOrigem> = {}): ClienteParaOrigem => ({
  id: "c1",
  nome: "Fulano",
  empresa: null,
  como_conheceu: "Instagram",
  contrato_preenchido_at: "2026-09-10T15:00:00Z",
  contrato_status: "assinado",
  pagamento_total: 2000,
  created_at: "2026-09-01T15:00:00Z",
  ...over,
});

test("fechou em = data do contrato preenchido; sem ela, não fechou", () => {
  const [a] = montarLinhas([cli()]);
  assert.equal(a.fechouEm, "2026-09-10");
  assert.equal(a.entrouEm, "2026-09-01");
  assert.equal(a.diasAteFechar, 9);

  const [b] = montarLinhas([cli({ contrato_preenchido_at: null })]);
  assert.equal(b.fechouEm, null);
  assert.equal(b.diasAteFechar, null);
});

test("a data é o dia em Brasília, não o do UTC", () => {
  // 01/10 às 01h UTC = 30/09 às 22h em Brasília. Num relatório que vai
  // virar decisão de verba, o mês errado é erro caro.
  assert.equal(diaBrasilia("2026-10-01T01:00:00Z"), "2026-09-30");
  assert.equal(diaBrasilia("2026-10-01T04:00:00Z"), "2026-10-01");
  assert.equal(diaBrasilia(null), null);
  assert.equal(diaBrasilia("não é data"), null);
});

test("sem origem cai num rótulo só, nunca em vazio", () => {
  for (const v of [null, "", "   "]) {
    const [l] = montarLinhas([cli({ como_conheceu: v })]);
    assert.equal(l.origem, SEM_ORIGEM);
  }
});

test("o nome segue a precedência do resto do app", () => {
  const [l] = montarLinhas([
    cli({ nome: "cadastro", empresa: "Empresa", nome_exibicao: "À mão" }),
  ]);
  assert.equal(l.cliente, "À mão");
});

test("quem fechou vem primeiro, do mais recente; quem não fechou vai pro fim", () => {
  const linhas = montarLinhas([
    cli({ id: "velho", contrato_preenchido_at: "2026-08-01T12:00:00Z" }),
    cli({ id: "lead", contrato_preenchido_at: null, created_at: "2026-09-20T12:00:00Z" }),
    cli({ id: "novo", contrato_preenchido_at: "2026-09-15T12:00:00Z" }),
  ]);
  assert.deepEqual(linhas.map((l) => l.id), ["novo", "velho", "lead"]);
});

test("o resumo por canal conta lead, fechado, valor e conversão", () => {
  const linhas = montarLinhas([
    cli({ id: "a", como_conheceu: "Instagram", pagamento_total: 2000 }),
    cli({ id: "b", como_conheceu: "Instagram", pagamento_total: 3000 }),
    cli({
      id: "c",
      como_conheceu: "Instagram",
      contrato_preenchido_at: null,
      pagamento_total: 0,
    }),
    cli({ id: "d", como_conheceu: "Indicação", pagamento_total: 5000 }),
  ]);
  const r = resumirPorOrigem(linhas);

  const insta = r.find((x) => x.origem === "Instagram")!;
  assert.equal(insta.leads, 3);
  assert.equal(insta.fechados, 2);
  assert.equal(insta.valor, 5000);
  assert.ok(Math.abs(insta.conversao - 2 / 3) < 0.001);

  // Mais fechados primeiro.
  assert.equal(r[0].origem, "Instagram");
});

test("o tempo típico é MEDIANA, não média", () => {
  // Um cliente que demorou 300 dias puxaria a média pra um número que não
  // descreve ninguém.
  const linhas = montarLinhas([
    cli({ id: "a", created_at: "2026-09-01T12:00:00Z", contrato_preenchido_at: "2026-09-03T12:00:00Z" }),
    cli({ id: "b", created_at: "2026-09-01T12:00:00Z", contrato_preenchido_at: "2026-09-05T12:00:00Z" }),
    cli({ id: "c", created_at: "2026-01-01T12:00:00Z", contrato_preenchido_at: "2026-10-28T12:00:00Z" }),
  ]);
  const [r] = resumirPorOrigem(linhas);
  assert.equal(r.medianaDias, 4);
});

test("canal sem ninguém fechado não inventa tempo", () => {
  const linhas = montarLinhas([
    cli({ como_conheceu: "TikTok", contrato_preenchido_at: null }),
  ]);
  const [r] = resumirPorOrigem(linhas);
  assert.equal(r.fechados, 0);
  assert.equal(r.medianaDias, null);
  assert.equal(r.conversao, 0);
});

/* ── O arquivo que ela baixa ──────────────────────────────────────────── */

test("vírgula e aspas no nome não quebram a planilha", () => {
  // "Souza, Maria" sem aspas vira duas colunas e desalinha o arquivo
  // inteiro — o mesmo erro que já quebrou a busca de clientes.
  assert.equal(celulaCSV("Souza, Maria"), '"Souza, Maria"');
  assert.equal(celulaCSV('Diz "oi"'), '"Diz ""oi"""');
  assert.equal(celulaCSV("Com;ponto e vírgula"), '"Com;ponto e vírgula"');
  assert.equal(celulaCSV("linha\nquebrada"), '"linha\nquebrada"');
  assert.equal(celulaCSV("simples"), "simples");
  assert.equal(celulaCSV(null), "");
  assert.equal(celulaCSV(12), "12");
});

test("o CSV abre no Excel em português: BOM, ponto e vírgula, vírgula decimal", () => {
  const csv = montarCSV(montarLinhas([cli({ pagamento_total: 1500.5 })]));
  assert.ok(csv.startsWith("﻿"), "falta o BOM — o Excel erra o acento");
  const linhas = csv.split("\r\n");
  assert.ok(linhas[0].includes("Cliente;Origem"), "separador errado");
  assert.ok(linhas[1].includes("1500,50"), "valor devia ter vírgula decimal");
});

test("quem não fechou sai com as colunas de fechamento vazias", () => {
  const csv = montarCSV(
    montarLinhas([cli({ contrato_preenchido_at: null, pagamento_total: 0 })])
  );
  const linha = csv.split("\r\n")[1].split(";");
  // Cliente;Origem;Entrou;Fechou;Dias;Assinado;Valor;...
  assert.equal(linha[3], "", "não fechou, mas veio data de fechamento");
  assert.equal(linha[5], "", "não fechou, mas disse se assinou");
  assert.equal(linha[6], "", "não fechou, mas veio valor");
});

test("diasEntre conta dia inteiro e aceita virada de mês", () => {
  assert.equal(diasEntre("2026-09-28", "2026-10-02"), 4);
  assert.equal(diasEntre("2026-09-01", "2026-09-01"), 0);
  assert.equal(diasEntre("torto", "2026-09-01"), null);
});
