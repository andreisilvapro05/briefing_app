import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDasDemandas } from "../src/lib/resumo-demandas.ts";
import type { ProjectTask } from "../src/lib/project-tasks.ts";

const HOJE = "2026-09-30";

const d = (over: Partial<ProjectTask> = {}): ProjectTask =>
  ({
    id: Math.random().toString(36).slice(2),
    client_id: null,
    area: "curso",
    titulo: "x",
    ordem: 0,
    status: "a-iniciar",
    prioridade: null,
    eisenhower: null,
    esforco: null,
    recorrencia: null,
    recorrencia_origem: null,
    responsavel: "karine",
    data_inicial: null,
    data_vencimento: null,
    concluida_em: null,
    observacoes: null,
    origem: "manual",
    anexos: [],
    created_at: "",
    updated_at: "",
    ...over,
  }) as ProjectTask;

test("conta só o que está aberto", () => {
  const r = resumoDasDemandas(
    [d(), d({ status: "concluido" }), d({ status: "completo-entregue" })],
    HOJE
  );
  assert.equal(r.abertas, 1);
});

test("atrasada é a de ontem; a de hoje não está atrasada", () => {
  const r = resumoDasDemandas(
    [
      d({ data_vencimento: "2026-09-29" }),
      d({ data_vencimento: HOJE }),
      d({ data_vencimento: "2026-10-05" }),
    ],
    HOJE
  );
  assert.equal(r.atrasadas, 1);
  assert.equal(r.paraHoje, 1);
});

test("sem prazo é contado à parte, e não vira atraso", () => {
  const r = resumoDasDemandas([d(), d({ data_vencimento: "2026-09-01" })], HOJE);
  assert.equal(r.semPrazo, 1);
  assert.equal(r.atrasadas, 1);
});

test("área e pessoa sem nada não entram no resumo", () => {
  const r = resumoDasDemandas([d({ area: "curso", responsavel: "karine" })], HOJE);
  assert.deepEqual(r.porArea.map((a) => a.value), ["curso"]);
  assert.deepEqual(r.porPessoa.map((p) => p.value), ["karine"]);
});

test("demanda sem área e sem dono ganha a própria fatia, por último", () => {
  const r = resumoDasDemandas(
    [d({ area: "curso" }), d({ area: null, responsavel: null })],
    HOJE
  );
  assert.equal(r.porArea.at(-1)?.label, "Sem área");
  assert.equal(r.porPessoa.at(-1)?.label, "Sem responsável");
});

test("a área nova entra no resumo como qualquer outra", () => {
  const r = resumoDasDemandas([d({ area: "ajustes-tecnicos" })], HOJE);
  assert.equal(r.porArea[0].label, "Ajustes técnicos");
  assert.equal(r.porArea[0].abertas, 1);
});

test("cada fatia sabe quantas das suas estão atrasadas", () => {
  const r = resumoDasDemandas(
    [
      d({ area: "curso", data_vencimento: "2026-09-01" }),
      d({ area: "curso", data_vencimento: "2026-12-01" }),
      d({ area: "marketing", data_vencimento: "2026-12-01" }),
    ],
    HOJE
  );
  const curso = r.porArea.find((a) => a.value === "curso");
  assert.equal(curso?.abertas, 2);
  assert.equal(curso?.atrasadas, 1);
  assert.equal(r.porArea.find((a) => a.value === "marketing")?.atrasadas, 0);
});

test("maiorArea serve de escala pra barra, e é zero na lista vazia", () => {
  assert.equal(resumoDasDemandas([], HOJE).maiorArea, 0);
  const r = resumoDasDemandas(
    [d({ area: "curso" }), d({ area: "curso" }), d({ area: "marketing" })],
    HOJE
  );
  assert.equal(r.maiorArea, 2);
});

test("toda fatia tem cor — sem cor a barra some da tela", () => {
  const r = resumoDasDemandas(
    [d({ area: "curso" }), d({ area: null, responsavel: null })],
    HOJE
  );
  for (const f of [...r.porArea, ...r.porPessoa]) {
    assert.match(f.barra, /^bg-/, `${f.label} sem cor`);
  }
});
