import { test } from "node:test";
import assert from "node:assert/strict";
import {
  statusParaClickUp,
  temEquivalenteNoClickUp,
} from "../src/lib/clickup-status-reverso.ts";
import { CLICKUP_STATUS_MAP } from "../src/lib/clickup.ts";

test("todo status que vem do ClickUp sabe voltar pra lá", () => {
  // Se o mapa de ida conhece um status, o de volta tem que conhecer também
  // — senão existe status que entra no app e não consegue mais sair.
  for (const [nomeNoClickUp, statusApp] of Object.entries(CLICKUP_STATUS_MAP)) {
    const volta = statusParaClickUp(statusApp);
    assert.ok(volta.length > 0, `${statusApp} não tem volta`);
    assert.ok(
      volta.includes(nomeNoClickUp),
      `${statusApp} não lista "${nomeNoClickUp}"`
    );
  }
});

test("o nome da lista de PROJETOS vem primeiro", () => {
  // "feito" e "completo| entregue" viram o mesmo status no app. Na volta, a
  // tarefa de projeto precisa do nome da pasta de projetos; "feito" é das
  // listas internas e seria recusado lá com 400.
  assert.equal(statusParaClickUp("completo-entregue")[0], "completo| entregue");
  assert.equal(statusParaClickUp("parado")[0], "parado");
  assert.equal(statusParaClickUp("a-iniciar")[0], "a iniciar");
});

test("os nomes das listas internas ficam de reserva, não somem", () => {
  // Uma tarefa que mora na lista interna só aceita "feito"; a reserva é o
  // que faz a escrita funcionar nos dois lugares.
  assert.deepEqual(statusParaClickUp("completo-entregue").sort(), [
    "completo| entregue",
    "feito",
  ]);
  assert.deepEqual(statusParaClickUp("parado").sort(), ["parado", "pendência"]);
  assert.deepEqual(statusParaClickUp("a-iniciar").sort(), [
    "a iniciar",
    "recorrente",
  ]);
});

test("status de um para um devolve o único nome", () => {
  assert.deepEqual(statusParaClickUp("design-pagina"), ["design da página"]);
  assert.deepEqual(statusParaClickUp("concluido"), ["concluído"]);
});

test("status que o ClickUp não conhece não é escrevível", () => {
  // "envio-informacoes" só existe no app (ver clickup-status-sync.ts).
  assert.deepEqual(statusParaClickUp("envio-informacoes"), []);
  assert.equal(temEquivalenteNoClickUp("envio-informacoes"), false);
  assert.equal(temEquivalenteNoClickUp("design-pagina"), true);
});
