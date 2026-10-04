import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ordenarProjetosDoMembro,
  resumoDosProjetos,
  type ProjetoDoMembro,
} from "../src/lib/meus-projetos.ts";

const HOJE = "2026-10-04";

const p = (
  nome: string,
  dataVencimento: string | null,
  extra: Partial<ProjetoDoMembro> = {}
): ProjetoDoMembro => ({
  id: `id-${nome}`,
  nome,
  status: "design-pagina",
  responsavel: "andrei",
  tarefa: "Design",
  dataInicial: null,
  dataVencimento,
  ataId: null,
  atas: 0,
  ...extra,
});

test("atrasado primeiro, depois o que vence antes, sem data no fim", () => {
  const r = ordenarProjetosDoMembro(
    [
      p("sem data", null),
      p("futuro", "2026-10-20"),
      p("atrasado", "2026-09-28"),
      p("hoje", HOJE),
    ],
    HOJE
  );
  assert.deepEqual(r.map((x) => x.nome), ["atrasado", "hoje", "futuro", "sem data"]);
});

test("finalizado vai pro fim mesmo com data vencida", () => {
  const r = ordenarProjetosDoMembro(
    [
      p("entregue", "2026-03-01", { status: "completo-entregue" }),
      p("sem data", null),
      p("atrasado", "2026-09-28"),
    ],
    HOJE
  );
  assert.deepEqual(r.map((x) => x.nome), ["atrasado", "sem data", "entregue"]);
});

test("mesmo peso e mesma data desempata por nome", () => {
  const r = ordenarProjetosDoMembro(
    [p("Zeca", "2026-10-10"), p("Ana", "2026-10-10"), p("Bruno", "2026-10-09")],
    HOJE
  );
  assert.deepEqual(r.map((x) => x.nome), ["Bruno", "Ana", "Zeca"]);
});

test("sem data nenhuma, a ordem é alfabética em pt-BR", () => {
  const r = ordenarProjetosDoMembro(
    [p("Ótica", null), p("Alfa", null), p("Ágil", null)],
    HOJE
  );
  assert.deepEqual(r.map((x) => x.nome), ["Ágil", "Alfa", "Ótica"]);
});

test("não reordena o array recebido", () => {
  const lista = [p("b", "2026-10-20"), p("a", "2026-09-01")];
  ordenarProjetosDoMembro(lista, HOJE);
  assert.deepEqual(lista.map((x) => x.nome), ["b", "a"]);
});

test("resumo conta atraso e hoje, e não chama entrega de atraso", () => {
  const r = resumoDosProjetos(
    [
      p("atrasado", "2026-09-28"),
      p("tambem atrasado", "2026-10-03"),
      p("hoje", HOJE),
      p("futuro", "2026-11-01"),
      p("sem data", null),
      // Entregue em março com data vencida: é história, não atraso. Foi
      // exatamente este erro que isClientStuck já cometeu uma vez.
      p("entregue", "2026-03-01", { status: "completo-entregue" }),
      p("concluido", "2026-01-01", { status: "concluido" }),
    ],
    HOJE
  );
  assert.deepEqual(r, {
    total: 7,
    atrasados: 2,
    vencemHoje: 1,
    finalizados: 2,
  });
});

test("lista vazia dá zeros, não NaN", () => {
  assert.deepEqual(resumoDosProjetos([], HOJE), {
    total: 0,
    atrasados: 0,
    vencemHoje: 0,
    finalizados: 0,
  });
});
