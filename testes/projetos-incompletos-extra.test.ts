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
