import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarProjetosAVencer,
  situacaoDoPrazo,
  diasEntre,
  ehRaiaFechada,
} from "../src/lib/projetos-a-vencer.ts";

const HOJE = "2026-09-24";

const grupo = (
  label: string,
  clients: { id: string; nome: string; empresa?: string | null; fechadas?: number; total?: number }[]
) => ({
  label,
  color: "#000000",
  clients: clients.map((c) => ({
    id: c.id,
    nome: c.nome,
    empresa: c.empresa ?? null,
    progresso: c.total === undefined ? null : { total: c.total, fechadas: c.fechadas ?? 0 },
  })),
});

const tarefa = (
  client_id: string,
  data_vencimento: string | null,
  titulo = "Copy LP",
  status = "em-andamento",
  responsavel: string | null = "valeria"
) => ({ client_id, titulo, status, responsavel, data_vencimento });

test("dias negativos são atraso; até 3 dias é atenção; depois, no prazo", () => {
  assert.equal(situacaoDoPrazo(-1), "atrasado");
  assert.equal(situacaoDoPrazo(0), "atencao");
  assert.equal(situacaoDoPrazo(3), "atencao");
  assert.equal(situacaoDoPrazo(4), "no-prazo");
});

test("diasEntre não escorrega no fuso nem na virada de mês", () => {
  assert.equal(diasEntre("2026-09-24", "2026-09-24"), 0);
  assert.equal(diasEntre("2026-09-24", "2026-09-25"), 1);
  assert.equal(diasEntre("2026-09-30", "2026-10-01"), 1);
  assert.equal(diasEntre("2026-09-24", "2026-09-20"), -4);
  assert.equal(diasEntre("2026-09-24", "nao-e-data"), null);
});

test("o prazo do projeto é o da tarefa aberta que vence primeiro", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana", total: 10, fechadas: 4 }])],
    [
      tarefa("c1", "2026-09-30", "Design"),
      tarefa("c1", "2026-09-26", "Copy LP"),
      tarefa("c1", "2026-10-10", "Publicação"),
    ],
    HOJE
  );
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].vencimento, "2026-09-26");
  assert.equal(r.itens[0].tarefa, "Copy LP");
  assert.equal(r.itens[0].dias, 2);
  assert.equal(r.itens[0].situacao, "atencao");
  assert.equal(r.itens[0].fechadas, 4);
  assert.equal(r.itens[0].total, 10);
});

test("tarefa fechada não define o prazo", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana" }])],
    [
      tarefa("c1", "2026-09-25", "Já entregue", "completo-entregue"),
      tarefa("c1", "2026-09-28", "Falta essa"),
    ],
    HOJE
  );
  assert.equal(r.itens[0].tarefa, "Falta essa");
});

test("o mais apertado vem primeiro, e o atrasado antes de todos", () => {
  const r = montarProjetosAVencer(
    [
      grupo("Criação", [
        { id: "c1", nome: "Ana" },
        { id: "c2", nome: "Bruno" },
        { id: "c3", nome: "Célia" },
      ]),
    ],
    [
      tarefa("c1", "2026-09-30"),
      tarefa("c2", "2026-09-20"),
      tarefa("c3", "2026-09-24"),
    ],
    HOJE
  );
  assert.deepEqual(
    r.itens.map((i) => `${i.nome}:${i.dias}`),
    ["Bruno:-4", "Célia:0", "Ana:6"]
  );
  assert.equal(r.atrasados, 1);
});

test("fora da janela não entra", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana" }])],
    [tarefa("c1", "2026-12-01")],
    HOJE
  );
  assert.equal(r.itens.length, 0);
  assert.equal(r.semData, 0);
});

test("projeto sem tarefa com data vira contador, não linha", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana" }, { id: "c2", nome: "Bruno" }])],
    [tarefa("c1", null), tarefa("c2", "2026-09-25")],
    HOJE
  );
  assert.equal(r.itens.length, 1);
  assert.equal(r.semData, 1);
});

test("data que o banco não interpreta não vira linha com NaN", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana" }])],
    [tarefa("c1", "31/12/2026")],
    HOJE
  );
  assert.equal(r.itens.length, 0);
  assert.equal(r.semData, 1);
});

test("o recorte por pessoa limita os projetos", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana" }, { id: "c2", nome: "Bruno" }])],
    [tarefa("c1", "2026-09-25"), tarefa("c2", "2026-09-26")],
    HOJE,
    { clientesPermitidos: new Set(["c2"]) }
  );
  assert.deepEqual(r.itens.map((i) => i.nome), ["Bruno"]);
  assert.equal(r.semData, 0);
});

test("o nome da empresa ganha do nome da pessoa quando existe", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana Silva", empresa: "Clínica Vida" }])],
    [tarefa("c1", "2026-09-25")],
    HOJE
  );
  assert.equal(r.itens[0].nome, "Clínica Vida");
});

test("empresa só com espaços não apaga o nome", () => {
  const r = montarProjetosAVencer(
    [grupo("Criação", [{ id: "c1", nome: "Ana Silva", empresa: "   " }])],
    [tarefa("c1", "2026-09-25")],
    HOJE
  );
  assert.equal(r.itens[0].nome, "Ana Silva");
});

test("o limite corta a lista mas não a contagem de atrasados", () => {
  const r = montarProjetosAVencer(
    [
      grupo("Criação", [
        { id: "c1", nome: "Ana" },
        { id: "c2", nome: "Bruno" },
        { id: "c3", nome: "Célia" },
      ]),
    ],
    [
      tarefa("c1", "2026-09-20"),
      tarefa("c2", "2026-09-21"),
      tarefa("c3", "2026-09-22"),
    ],
    HOJE,
    { limite: 2 }
  );
  assert.equal(r.itens.length, 2);
  assert.equal(r.atrasados, 3);
});

test("a etapa vem da raia em que o projeto está", () => {
  const r = montarProjetosAVencer(
    [
      grupo("Onboarding", [{ id: "c1", nome: "Ana" }]),
      grupo("Criação", [{ id: "c2", nome: "Bruno" }]),
    ],
    [tarefa("c1", "2026-09-25"), tarefa("c2", "2026-09-26")],
    HOJE
  );
  assert.deepEqual(
    r.itens.map((i) => `${i.nome}/${i.etapa}`),
    ["Ana/Onboarding", "Bruno/Criação"]
  );
});

test("raia de projeto entregue não conta, nem como sem data", () => {
  const entregue = {
    id: "status-completo-entregue",
    ...grupo("Completo | Entregue", [{ id: "c9", nome: "Já foi" }]),
  };
  const r = montarProjetosAVencer(
    [entregue, { id: "status-em-andamento", ...grupo("Em andamento", [{ id: "c1", nome: "Ana" }]) }],
    [tarefa("c9", "2026-09-25"), tarefa("c1", null)],
    HOJE
  );
  assert.equal(r.itens.length, 0);
  assert.equal(r.semData, 1);
});

test("ehRaiaFechada reconhece as duas raias terminais e ignora o resto", () => {
  assert.ok(ehRaiaFechada("status-completo-entregue"));
  assert.ok(ehRaiaFechada("status-concluido"));
  assert.ok(!ehRaiaFechada("status-em-andamento"));
  assert.ok(!ehRaiaFechada(undefined));
});
