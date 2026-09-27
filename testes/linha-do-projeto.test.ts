import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaDoProjeto } from "../src/lib/linha-do-projeto.ts";

const t = (
  titulo: string,
  data_vencimento: string | null,
  responsavel: string | null = "valeria",
  status = "em-andamento",
  data_inicial: string | null = null,
  prioridade: string | null = null
) => ({ titulo, status, responsavel, prioridade, data_inicial, data_vencimento });

test("manda a tarefa aberta que vence primeiro", () => {
  const r = linhaDoProjeto([
    t("Design", "2026-10-05"),
    t("Copy", "2026-10-01", "karine", "em-andamento", "2026-09-28", "alta"),
    t("Publicar", "2026-10-20"),
  ]);
  assert.equal(r.tarefa, "Copy");
  assert.equal(r.responsavel, "karine");
  assert.equal(r.dataInicial, "2026-09-28");
  assert.equal(r.dataVencimento, "2026-10-01");
  assert.equal(r.prioridade, "alta");
});

test("tarefa fechada não manda", () => {
  const r = linhaDoProjeto([
    t("Já foi", "2026-09-01", "valeria", "completo-entregue"),
    t("Falta", "2026-10-10"),
  ]);
  assert.equal(r.tarefa, "Falta");
});

test("sem data vai pro fim, mas serve se for tudo que tem", () => {
  const comData = linhaDoProjeto([t("Sem data", null), t("Com data", "2026-10-10")]);
  assert.equal(comData.tarefa, "Com data");
  const soSemData = linhaDoProjeto([t("Sem data", null)]);
  assert.equal(soSemData.tarefa, "Sem data");
  assert.equal(soSemData.dataVencimento, null);
});

test("projeto sem tarefa aberta devolve tudo vazio", () => {
  const r = linhaDoProjeto([t("Encerrada", "2026-09-01", "valeria", "concluido")]);
  assert.deepEqual(r, {
    responsavel: null,
    dataInicial: null,
    dataVencimento: null,
    prioridade: null,
    tarefa: null,
  });
});

test("com pessoa, só as tarefas dela contam — é a 'Lista Andrei'", () => {
  const tarefas = [
    t("Copy", "2026-10-01", "karine"),
    t("Design", "2026-10-09", "andrei", "em-andamento", "2026-10-02"),
  ];
  const geral = linhaDoProjeto(tarefas);
  assert.equal(geral.tarefa, "Copy");
  const doAndrei = linhaDoProjeto(tarefas, "andrei");
  assert.equal(doAndrei.tarefa, "Design");
  assert.equal(doAndrei.responsavel, "andrei");
  assert.equal(doAndrei.dataInicial, "2026-10-02");
});

test("pessoa sem tarefa aberta no projeto devolve vazio", () => {
  const r = linhaDoProjeto([t("Copy", "2026-10-01", "karine")], "andrei");
  assert.equal(r.tarefa, null);
});

test("não reordena o array que recebeu", () => {
  const tarefas = [t("B", "2026-10-09"), t("A", "2026-10-01")];
  linhaDoProjeto(tarefas);
  assert.deepEqual(tarefas.map((x) => x.titulo), ["B", "A"]);
});
