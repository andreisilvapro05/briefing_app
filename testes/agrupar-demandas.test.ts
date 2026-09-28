import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGRUPAMENTOS,
  SEM_VALOR,
  agruparDemandas,
  ordenarDemandas,
} from "../src/lib/agrupar-demandas.ts";
import type { ProjectTask } from "../src/lib/project-tasks.ts";

const d = (over: Partial<ProjectTask> = {}): ProjectTask =>
  ({
    id: Math.random().toString(36).slice(2),
    titulo: "x",
    status: "a-iniciar",
    area: "curso",
    responsavel: "karine",
    eisenhower: null,
    esforco: null,
    data_vencimento: null,
    client_id: null,
    ...over,
  }) as ProjectTask;

const rotulos = (gs: { rotulo: string; tarefas: unknown[] }[]) =>
  gs.filter((g) => g.tarefas.length > 0).map((g) => g.rotulo);

test("agrupa por área, na ordem da lista e não em ordem alfabética", () => {
  // A ordem das áreas é uma decisão de quem olha a tela (Comercial por
  // último, 28/09) — alfabética jogaria Comercial de volta para cima.
  const gs = agruparDemandas(
    [d({ area: "comercial" }), d({ area: "atendimento" }), d({ area: "curso" })],
    "area",
    true,
    "importancia"
  );

  assert.deepEqual(rotulos(gs), ["Atendimento", "Curso", "Comercial"]);
});

test("inverter o sentido vira as gavetas, e só elas", () => {
  const gs = agruparDemandas(
    [d({ area: "comercial" }), d({ area: "atendimento" })],
    "area",
    false,
    "importancia"
  );

  assert.deepEqual(rotulos(gs), ["Comercial", "Atendimento"]);
});

test("quem não tem valor no eixo fica por último, nos dois sentidos", () => {
  // Uma demanda sem área não pode virar a primeira coisa que se vê.
  for (const crescente of [true, false]) {
    const gs = agruparDemandas(
      [d({ area: null }), d({ area: "curso" })],
      "area",
      crescente,
      "importancia"
    );
    assert.equal(rotulos(gs).at(-1), "Sem área");
  }
});

test("agrupa por status, por responsável e por importância", () => {
  const tarefas = [
    d({ status: "em-andamento", responsavel: "taina", eisenhower: "fazer" }),
    d({ status: "a-iniciar", responsavel: "karine", eisenhower: "planejar" }),
  ];

  assert.deepEqual(rotulos(agruparDemandas(tarefas, "status", true, "importancia")), [
    "A iniciar",
    "Em andamento",
  ]);
  assert.deepEqual(rotulos(agruparDemandas(tarefas, "responsavel", true, "importancia")), [
    "Tainá",
    "Karine",
  ]);
  assert.deepEqual(rotulos(agruparDemandas(tarefas, "importancia", true, "importancia")), [
    "Fazer agora",
    "Planejar",
  ]);
});

test("uma chave que não está na lista canônica ainda ganha gaveta", () => {
  // Um status antigo, ou alguém que saiu do time: a demanda tem de aparecer
  // em algum lugar, senão some da tela sem ninguém saber por quê.
  const gs = agruparDemandas(
    [d({ responsavel: "alguem-que-saiu" })],
    "responsavel",
    true,
    "importancia"
  );

  const visiveis = gs.filter((g) => g.tarefas.length > 0);
  assert.equal(visiveis.length, 1);
  assert.equal(visiveis[0].chave, "alguem-que-saiu");
});

test("nenhuma demanda se perde no agrupamento", () => {
  const tarefas = [
    d({ area: "curso" }),
    d({ area: null }),
    d({ area: "marketing" }),
    d({ area: "curso" }),
  ];

  for (const eixo of Object.keys(AGRUPAMENTOS) as (keyof typeof AGRUPAMENTOS)[]) {
    const total = agruparDemandas(tarefas, eixo, true, "importancia").reduce(
      (n, g) => n + g.tarefas.length,
      0
    );
    assert.equal(total, tarefas.length, `perdeu demanda agrupando por ${eixo}`);
  }
});

test("a gaveta de quem não tem valor usa a chave reservada", () => {
  const gs = agruparDemandas([d({ esforco: null })], "esforco", true, "importancia");
  const sem = gs.find((g) => g.tarefas.length > 0);

  assert.equal(sem?.chave, SEM_VALOR);
  assert.equal(sem?.rotulo, "Sem estimativa");
});

test("dentro da gaveta, importância manda e o prazo desempata", () => {
  const urgente = d({ eisenhower: "fazer", data_vencimento: "2026-12-01" });
  const planejar = d({ eisenhower: "planejar", data_vencimento: "2026-01-01" });
  const outroUrgente = d({ eisenhower: "fazer", data_vencimento: "2026-01-02" });

  const ordenadas = ordenarDemandas([planejar, urgente, outroUrgente], "importancia");

  assert.deepEqual(ordenadas.map((t) => t.id), [outroUrgente.id, urgente.id, planejar.id]);
});

test("por prazo, quem não tem data vai para o fim", () => {
  const comData = d({ data_vencimento: "2026-05-05" });
  const semData = d({ data_vencimento: null });

  const ordenadas = ordenarDemandas([semData, comData], "prazo");

  assert.deepEqual(ordenadas.map((t) => t.id), [comData.id, semData.id]);
});
