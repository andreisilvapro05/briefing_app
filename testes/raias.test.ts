import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GENERAL_LANES,
  LANE_TONE_CLASSES,
  computeStats,
  isClientStuck,
  laneForClient,
  statusLaneId,
  type ClientForLane,
} from "../src/lib/workflow-lanes.ts";
import {
  DEFAULT_TASK_STATUS,
  PROJECT_STATUS_OPTIONS,
  TASK_STATUS_VALUES,
} from "../src/lib/project-tasks.ts";

/**
 * A regra que estas verificações protegem: TODO cliente aparece em algum
 * lugar do Quadro, e a soma das partes da Visão Geral dá o total.
 *
 * O jeito de esta tela errar sem dar erro é a "raia fantasma": tanto o
 * Quadro quanto a Visão Geral montam o mapa a partir de `GENERAL_LANES` e
 * empilham com `byLane.get(laneForClient(c))?.push(c)`. O `?.` engole o
 * cliente cuja raia não existe — sem exceção, sem log, sem coluna vazia.
 * Ele simplesmente não está mais na tela, e a contagem do topo passa a
 * mentir.
 *
 * Todos os clientes aqui são inventados.
 */

const DIA = 86_400_000;
const IDS_DAS_RAIAS = new Set(GENERAL_LANES.map((l) => l.id));

function cliente(over: Partial<ClientForLane> = {}): ClientForLane {
  return {
    id: "cli-faz-de-conta",
    nome: "Fulana de Tal",
    empresa: "Empresa Inventada Ltda",
    project_type: null,
    status: "a-iniciar",
    current_stage_index: null,
    briefing_submitted_at: null,
    contrato_preenchido_at: null,
    chamada_agendada_at: null,
    contrato_status: null,
    pagamento_total: null,
    pagamento_pago: null,
    last_client_activity_at: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

/** Data local (sem fuso no texto) pra não virar o mês na conversão. */
function meioDia(ano: number, mes1a12: number, dia: number) {
  return `${ano}-${String(mes1a12).padStart(2, "0")}-${String(dia).padStart(2, "0")}T12:00:00`;
}

// --- Raias: nenhum cliente pode sumir da tela ---

test("todo status de projeto tem uma raia, e nenhum id de raia se repete", () => {
  // Invariante entre duas listas que precisam concordar: as opções de
  // status do projeto e as colunas do Quadro.
  for (const opt of PROJECT_STATUS_OPTIONS) {
    const raia = laneForClient(cliente({ status: opt.value }));
    assert.ok(
      IDS_DAS_RAIAS.has(raia),
      `status "${opt.value}" caiu na raia inexistente "${raia}"`
    );
  }
  assert.equal(IDS_DAS_RAIAS.size, GENERAL_LANES.length, "há id de raia repetido");
  assert.equal(IDS_DAS_RAIAS.size, PROJECT_STATUS_OPTIONS.length);
});

test("status que o app não conhece não some do Quadro: cai na raia padrão", () => {
  // Como um status chega torto de verdade: nome cru do ClickUp, valor
  // vazio, nulo, ou o mesmo valor com sujeira em volta.
  const tortos = [
    "Aguardando Cliente",
    "REDAÇÃO/COPY",
    "a-iniciar ",
    "em_andamento",
    "",
    "   ",
    null,
  ];
  for (const status of tortos) {
    const raia = laneForClient(cliente({ status }));
    assert.ok(IDS_DAS_RAIAS.has(raia), `status ${JSON.stringify(status)} virou raia fantasma`);
    assert.equal(raia, statusLaneId(DEFAULT_TASK_STATUS), `status ${JSON.stringify(status)}`);
  }
});

test(
  "nenhum status da taxonomia vira raia fantasma",
  () => {
    for (const status of TASK_STATUS_VALUES) {
      const raia = laneForClient(cliente({ status }));
      assert.ok(IDS_DAS_RAIAS.has(raia), `status "${status}" caiu na raia inexistente "${raia}"`);
    }
  }
);

test("toda raia tem rótulo e um tom com classe de cor de verdade", () => {
  // Tom sem entrada em LANE_TONE_CLASSES chega na tela como `undefined` e
  // a coluna inteira quebra ao ler `tone.bg`.
  for (const lane of GENERAL_LANES) {
    assert.ok(lane.label.trim().length > 0, `raia "${lane.id}" sem rótulo`);
    const classes = LANE_TONE_CLASSES[lane.tone];
    assert.ok(classes, `raia "${lane.id}" usa o tom "${lane.tone}", que não tem classe`);
    for (const campo of ["bg", "border", "text", "dot"] as const) {
      assert.ok(
        classes[campo] && classes[campo].trim().length > 0,
        `tom "${lane.tone}" sem ${campo}`
      );
    }
  }
});

// --- Parado: a fronteira dos 14 dias ---

test("a fronteira dos 14 dias sem atividade", () => {
  const agora = Date.parse("2026-09-22T10:00:00Z");
  const desde = (ms: number) =>
    isClientStuck(cliente({ last_client_activity_at: new Date(agora - ms).toISOString() }), agora);

  assert.equal(desde(13 * DIA), false, "13 dias ainda não é parado");
  assert.equal(desde(14 * DIA - 1), false, "faltando 1ms pra 14 dias ainda não é parado");
  assert.equal(desde(14 * DIA), true, "14 dias cravados já é parado");
  assert.equal(desde(15 * DIA), true);
});

test("sem atividade registrada, quem conta é a data de criação", () => {
  const agora = Date.parse("2026-09-22T10:00:00Z");
  const velho = new Date(agora - 40 * DIA).toISOString();

  assert.equal(
    isClientStuck(cliente({ created_at: velho, last_client_activity_at: null }), agora),
    true,
    "cadastrado há 40 dias e nunca respondeu"
  );
  assert.equal(
    isClientStuck(
      cliente({ created_at: velho, last_client_activity_at: new Date(agora - DIA).toISOString() }),
      agora
    ),
    false,
    "cliente antigo que respondeu ontem não está parado"
  );
});

test("relógio adiantado: atividade no futuro não marca parado", () => {
  const agora = Date.parse("2026-09-22T10:00:00Z");
  const futuro = new Date(agora + 3 * DIA).toISOString();
  assert.equal(isClientStuck(cliente({ last_client_activity_at: futuro }), agora), false);
});

test("data torta não inventa um cliente parado", () => {
  const agora = Date.parse("2026-09-22T10:00:00Z");
  for (const lixo of ["ontem", "0000-00-00", "2026-13-45", ""]) {
    assert.equal(
      isClientStuck(cliente({ last_client_activity_at: lixo }), agora),
      false,
      `"${lixo}" não pode virar "parado"`
    );
  }
});

test(
  "projeto entregue não fica marcado como parado",
  () => {
    const agora = Date.parse("2026-09-22T10:00:00Z");
    const entregue = cliente({
      status: "completo-entregue",
      last_client_activity_at: new Date(agora - 90 * DIA).toISOString(),
    });
    assert.equal(isClientStuck(entregue, agora), false);
  }
);

// --- Visão Geral: a soma das partes tem que dar o todo ---

test("lista vazia não quebra nem inventa número", () => {
  const s = computeStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.receitaTotal, 0);
  assert.equal(s.receitaPaga, 0);
  assert.equal(s.receitaPendente, 0);
  assert.equal(s.mediaPorMes, 0);
  assert.deepEqual(s.parados, []);
  assert.equal(s.porTipo.size, 0);
  assert.equal(s.ultimosMeses.length, 6, "a série de meses existe mesmo sem cliente");
  assert.equal(s.porLane.size, GENERAL_LANES.length, "toda raia aparece, mesmo vazia");
  for (const lane of GENERAL_LANES) assert.deepEqual(s.porLane.get(lane.id), []);
});

test("um cliente só aparece em exatamente uma raia", () => {
  const s = computeStats([cliente({ id: "u1", status: "design-pagina" })]);
  assert.equal(s.total, 1);
  const comCliente = GENERAL_LANES.filter((l) => (s.porLane.get(l.id)?.length ?? 0) > 0);
  assert.equal(comCliente.length, 1);
  assert.equal(comCliente[0].id, statusLaneId("design-pagina"));
});

test("a soma das raias, dos tipos e dos status dá o total", () => {
  // Se não der, algum cliente está sendo contado duas vezes ou nenhuma.
  const clientes = [
    cliente({ id: "a", status: "onboarding", project_type: "landing-com-copy" }),
    cliente({ id: "b", status: "onboarding", project_type: "landing-com-copy" }),
    cliente({ id: "c", status: "completo-entregue", project_type: "seo" }),
    cliente({ id: "d", status: "Nome Que Veio Do ClickUp", project_type: null }),
    cliente({ id: "e", status: null, project_type: "site-completo" }),
    cliente({ id: "f", status: "", project_type: "outro" }),
    cliente({ id: "g", status: "parado", project_type: "seo" }),
  ];
  const s = computeStats(clientes);

  assert.equal(s.total, clientes.length);

  let naRaia = 0;
  for (const lane of GENERAL_LANES) naRaia += s.porLane.get(lane.id)?.length ?? 0;
  assert.equal(naRaia, s.total, "cliente sumiu entre as raias");

  const soma = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  assert.equal(soma(s.porTipo), s.total, "a pizza de tipos não fecha com o total");
  assert.equal(soma(s.porStatus), s.total, "a contagem por status não fecha com o total");

  // Nenhum cliente aparece em duas raias ao mesmo tempo.
  const vistos = new Set<string>();
  for (const lane of GENERAL_LANES) {
    for (const c of s.porLane.get(lane.id) ?? []) {
      assert.ok(!vistos.has(c.id), `cliente "${c.id}" contado duas vezes`);
      vistos.add(c.id);
    }
  }
  assert.equal(vistos.size, s.total);
});

test("cliente sem tipo é contado, não descartado", () => {
  const s = computeStats([cliente({ id: "x", project_type: null })]);
  assert.equal(s.porTipo.get("—"), 1);
});

test("receita: valor faltando vale zero, e o pendente é o que falta receber", () => {
  const s = computeStats([
    cliente({ id: "a", pagamento_total: 3500, pagamento_pago: 1750 }),
    cliente({ id: "b", pagamento_total: 1200, pagamento_pago: null }),
    cliente({ id: "c", pagamento_total: null, pagamento_pago: null }),
  ]);
  assert.equal(s.receitaTotal, 4700);
  assert.equal(s.receitaPaga, 1750);
  assert.equal(s.receitaPendente, 2950);
  assert.ok(Number.isFinite(s.receitaTotal), "nulo não pode virar NaN");
});

test("a média por mês olha os últimos 6 meses, não a vida inteira da agência", () => {
  const hoje = new Date();
  const esteMes = meioDia(hoje.getFullYear(), hoje.getMonth() + 1, 15);
  const s = computeStats([
    cliente({ id: "a", created_at: esteMes }),
    cliente({ id: "b", created_at: esteMes }),
    cliente({ id: "c", created_at: esteMes }),
    // Cliente de 2019: entra no total, mas não na média dos 6 meses.
    cliente({ id: "d", created_at: meioDia(2019, 3, 10) }),
  ]);

  assert.equal(s.total, 4);
  assert.equal(s.ultimosMeses.length, 6);
  assert.equal(s.ultimosMeses[5].count, 3, "o último da série é o mês corrente");
  assert.equal(s.ultimosMeses.reduce((a, m) => a + m.count, 0), 3);
  assert.equal(s.mediaPorMes, 0.5);
  for (const m of s.ultimosMeses) {
    assert.ok(m.label.trim().length > 0, "mês sem rótulo na série");
  }
});
