import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contar,
  fraseDasPerguntas,
  montarPerguntas,
  respostaVazia,
  resumoDaResposta,
} from "../src/lib/perguntas-pendentes.ts";
import type { CustomQuestion } from "../src/lib/custom-questions.ts";

const p = (id: string, label = "Pergunta"): CustomQuestion => ({
  id,
  client_id: "c1",
  label,
  hint: null,
  tipo: "texto-longo",
  opcoes: [],
  ordem: 0,
  created_at: "2026-10-01T00:00:00Z",
});

test("resposta em branco conta como pendente", () => {
  // O cliente que passa pelo bloco sem escrever grava "". Contar isso como
  // respondida é o jeito mais fácil de a tela mentir.
  for (const vazio of [null, undefined, "", "   ", [], ["", "  "], {}]) {
    assert.equal(respostaVazia(vazio), true, JSON.stringify(vazio));
  }
});

test("resposta com conteúdo conta como respondida", () => {
  for (const cheio of ["oi", "  oi  ", ["a"], ["", "b"], 0, false]) {
    assert.equal(respostaVazia(cheio), false, JSON.stringify(cheio));
  }
});

test("múltipla escolha vira uma linha só", () => {
  assert.equal(resumoDaResposta(["Instagram", "Google"]), "Instagram · Google");
  assert.equal(resumoDaResposta(["Instagram", ""]), "Instagram");
  assert.equal(resumoDaResposta([]), null);
});

test("texto é aparado", () => {
  assert.equal(resumoDaResposta("  resposta  "), "resposta");
});

test("zero e falso são respostas de verdade, não vazio", () => {
  // `0` e `false` são falsy em JS — um `if (valor)` descartaria os dois e a
  // pergunta apareceria como pendente mesmo respondida.
  assert.equal(resumoDaResposta(0), "0");
  assert.equal(resumoDaResposta(false), "false");
});

test("casa a pergunta com a resposta pelo field_id do bloco", () => {
  const lista = montarPerguntas(
    [p("a"), p("b"), p("c")],
    new Map<string, unknown>([
      ["perguntas-especificas.a", "tenho sim"],
      ["perguntas-especificas.b", "   "],
      // "c" nem foi visitada
    ])
  );
  assert.deepEqual(
    lista.map((x) => [x.pergunta.id, x.respondida]),
    [
      ["a", true],
      ["b", false],
      ["c", false],
    ]
  );
  assert.equal(lista[0].resumo, "tenho sim");
  assert.equal(lista[1].resumo, null);
});

test("resposta de outro bloco não conta", () => {
  // O mapa de respostas do briefing inteiro tem field_id de todos os
  // blocos; só o prefixo `perguntas-especificas.` vale aqui.
  const lista = montarPerguntas(
    [p("a")],
    new Map<string, unknown>([["sobre-voce.a", "resposta de outro bloco"]])
  );
  assert.equal(lista[0].respondida, false);
});

test("contagem e frase", () => {
  const lista = montarPerguntas(
    [p("a"), p("b"), p("c")],
    new Map<string, unknown>([["perguntas-especificas.a", "x"]])
  );
  assert.deepEqual(contar(lista), { total: 3, respondidas: 1, pendentes: 2 });
  assert.equal(fraseDasPerguntas(contar(lista)), "faltam 2 de 3");
});

test("frase no singular e no tudo-respondido", () => {
  assert.equal(
    fraseDasPerguntas({ total: 2, respondidas: 1, pendentes: 1 }),
    "falta 1 de 2"
  );
  assert.equal(
    fraseDasPerguntas({ total: 4, respondidas: 4, pendentes: 0 }),
    "Tudo respondido (4)"
  );
  assert.equal(
    fraseDasPerguntas({ total: 0, respondidas: 0, pendentes: 0 }),
    "Nenhuma pergunta específica ainda"
  );
});
