import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pendenciasDoProjeto,
  projetoIncompleto,
  faltasEmTexto,
} from "../src/lib/projetos-incompletos.ts";

const base = { projectType: "landing-com-copy" as const, totalTarefas: 10 };

test("entregue com tarefa aberta é contradição e conta como incompleto", () => {
  const p = pendenciasDoProjeto({ ...base, fechado: true, tarefasAbertas: 3 });
  assert.equal(p.entregueComTarefaAberta, true);
  assert.ok(projetoIncompleto(p));
  assert.ok(
    faltasEmTexto(p).some((f) => f.includes("entregue")),
    "a frase precisa dizer o que está errado"
  );
});

test("entregue com tudo fechado está certo", () => {
  const p = pendenciasDoProjeto({ ...base, fechado: true, tarefasAbertas: 0 });
  assert.equal(p.entregueComTarefaAberta, false);
  assert.ok(!projetoIncompleto(p));
});

test("projeto em andamento com tarefa aberta é o normal, não pendência", () => {
  const p = pendenciasDoProjeto({ ...base, fechado: false, tarefasAbertas: 7 });
  assert.equal(p.entregueComTarefaAberta, false);
});

test("sem os campos novos, o comportamento antigo não muda", () => {
  const p = pendenciasDoProjeto(base);
  assert.equal(p.entregueComTarefaAberta, false);
  assert.ok(!projetoIncompleto(p));
});

/* ── Lista de materiais (item 4 do processo da Karine, 26/09) ────────── */

test("etapa inicial sem lista de materiais é pendência", () => {
  const p = pendenciasDoProjeto({
    projectType: "landing-com-copy",
    totalTarefas: 11,
    status: "onboarding",
    totalMateriais: 0,
  });
  assert.equal(p.semListaDeMateriais, true);
  assert.equal(projetoIncompleto(p), true);
  assert.ok(
    faltasEmTexto(p).includes("sem a lista do que o cliente precisa enviar")
  );
});

test("etapa avançada sem lista NÃO é pendência — não há mais o que cobrar", () => {
  for (const status of ["design-pagina", "implementacao", "redacao-copy"]) {
    const p = pendenciasDoProjeto({
      projectType: "landing-com-copy",
      totalTarefas: 11,
      status,
      totalMateriais: 0,
    });
    assert.equal(p.semListaDeMateriais, false, status);
  }
});

test("projeto fechado nunca cobra material, mesmo em status inicial", () => {
  const p = pendenciasDoProjeto({
    projectType: "landing-com-copy",
    totalTarefas: 11,
    status: "onboarding",
    totalMateriais: 0,
    fechado: true,
  });
  assert.equal(p.semListaDeMateriais, false);
});

test("quem já tem lista não é apontado", () => {
  const p = pendenciasDoProjeto({
    projectType: "landing-com-copy",
    totalTarefas: 11,
    status: "onboarding",
    totalMateriais: 3,
  });
  assert.equal(p.semListaDeMateriais, false);
});

test("tela que não mede materiais não acusa a pendência", () => {
  // `totalMateriais` ausente = não medido. Acusar o que não se mediu
  // marcaria 47 projetos como incompletos de uma vez.
  const p = pendenciasDoProjeto({
    projectType: "landing-com-copy",
    totalTarefas: 11,
    status: "onboarding",
  });
  assert.equal(p.semListaDeMateriais, false);
  assert.equal(projetoIncompleto(p), false);
});

test('"parado" cobra material: é justamente onde o cliente travou', () => {
  const p = pendenciasDoProjeto({
    projectType: "landing-com-copy",
    totalTarefas: 11,
    status: "parado",
    totalMateriais: 0,
  });
  assert.equal(p.semListaDeMateriais, true);
});
