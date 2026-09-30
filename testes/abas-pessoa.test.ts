import { test } from "node:test";
import assert from "node:assert/strict";
import {
  abasPorPessoa,
  naOrdemDaBarra,
  projetosDaPessoa,
  respValido,
  SEM_RESPONSAVEL,
} from "../src/lib/abas-pessoa.ts";

const t = (
  client_id: string | null,
  responsavel: string | null,
  data_vencimento: string | null,
  status = "em-andamento"
) => ({ client_id, responsavel, status, data_vencimento });

const p = (id: string, responsavel: string | null) => ({ id, responsavel });
const rotulos = (abas: { label: string }[]) => abas.map((a) => a.label);

test('só "Todos" tem número; as abas de pessoa são só o nome', () => {
  const abas = abasPorPessoa(
    [t("c1", "valeria", "2026-10-01"), t("c2", "valeria", "2026-10-03")],
    "/admin/lista",
    "",
    "",
    2
  );
  assert.equal(abas[0].label, "Todos");
  assert.equal(abas[0].count, 2);
  const v = abas.find((a) => a.value === "valeria");
  assert.equal(v?.count, undefined, "nome de pessoa não leva número");
  assert.equal(v?.nota, undefined, "nem a nota de sem prazo");
});

test("Karine e Andrei vêm primeiro na barra", () => {
  const abas = abasPorPessoa(
    [
      t("c1", "valeria", "2026-10-01"),
      t("c2", "taina", "2026-10-01"),
      t("c3", "andrei", "2026-10-01"),
      t("c4", "karine", "2026-10-01"),
    ],
    "/admin/lista",
    "",
    ""
  );
  assert.deepEqual(rotulos(abas), ["Todos", "Karine", "Andrei", "Tainá", "Valéria"]);
});

test("naOrdemDaBarra não perde nem duplica ninguém", () => {
  const entrada = [{ value: "a" }, { value: "karine" }, { value: "b" }, { value: "andrei" }];
  const saida = naOrdemDaBarra(entrada);
  assert.deepEqual(saida.map((m) => m.value), ["karine", "andrei", "a", "b"]);
  assert.equal(saida.length, entrada.length);
});

test("o responsável DO PROJETO entra no recorte, não só o das tarefas", () => {
  // O caso do Andrei em 30/09: gestor de todo projeto, dono de etapa
  // nenhuma. Antes a aba dele abria vazia.
  const tarefas = [t("c1", "valeria", "2026-10-01"), t("c2", "valeria", "2026-10-01")];
  const projetos = [p("c1", "andrei"), p("c2", "andrei")];
  assert.deepEqual(
    [...projetosDaPessoa(tarefas, "andrei", projetos)].sort(),
    ["c1", "c2"]
  );
});

test("e quem é dono do projeto aparece na barra mesmo sem tarefa", () => {
  const abas = abasPorPessoa(
    [t("c1", "valeria", "2026-10-01")],
    "/admin/lista",
    "",
    "",
    1,
    [p("c1", "andrei")]
  );
  assert.ok(abas.some((a) => a.value === "andrei"));
});

test("o recorte soma projeto sob responsabilidade e projeto com tarefa dela", () => {
  const tarefas = [t("c2", "karine", "2026-10-01")];
  const projetos = [p("c1", "karine"), p("c2", "andrei")];
  assert.deepEqual(
    [...projetosDaPessoa(tarefas, "karine", projetos)].sort(),
    ["c1", "c2"]
  );
});

test("tarefa sem prazo não puxa o projeto pro recorte", () => {
  const tarefas = [t("c1", "valeria", "2026-10-01"), t("c2", "valeria", null)];
  assert.deepEqual([...projetosDaPessoa(tarefas, "valeria")], ["c1"]);
});

test("status fechado não entra no recorte", () => {
  const tarefas = [t("c1", "valeria", "2026-10-01", "completo-entregue")];
  assert.deepEqual([...projetosDaPessoa(tarefas, "valeria")], []);
});

test("pessoa sem NENHUM trabalho aberto não vira aba", () => {
  const abas = abasPorPessoa([t("c1", "karine", "2026-10-01")], "/admin/lista", "", "");
  assert.ok(!abas.some((a) => a.label === "Tainá"));
});

test("quem só tem trabalho SEM prazo continua aparecendo", () => {
  // Caso real de 27/09: Andrei com 102 abertas, nenhuma com data. Some da
  // barra seria esconder justamente quem precisa agendar.
  const abas = abasPorPessoa(
    [t("c1", "valeria", "2026-10-01"), t("c2", "andrei", null)],
    "/admin/lista",
    "",
    ""
  );
  assert.ok(abas.some((a) => a.value === "andrei"));
});

test("mas a pessoa escolhida continua na barra mesmo zerada", () => {
  const abas = abasPorPessoa(
    [t("c1", "karine", "2026-10-01")],
    "/admin/lista",
    "",
    "taina"
  );
  assert.deepEqual(abas.find((a) => a.value === "taina"), {
    value: "taina",
    label: "Tainá",
    iniciais: "T",
    cor: "bg-amber-500",
    href: "/admin/lista?resp=taina",
  });
});

test("projeto sem dono nenhum ganha a aba própria, por último", () => {
  const abas = abasPorPessoa(
    [t("c1", "karine", "2026-10-01")],
    "/admin/lista",
    "",
    "",
    2,
    [p("c1", "karine"), p("c2", null)]
  );
  assert.equal(abas.at(-1)?.value, SEM_RESPONSAVEL);
  assert.equal(abas.at(-1)?.label, "Sem responsável");
  assert.equal(SEM_RESPONSAVEL, "__sem__");
});

test('"Sem responsável" acha o projeto órfão, não só a tarefa órfã', () => {
  const projetos = [p("c1", "andrei"), p("c2", null)];
  assert.deepEqual([...projetosDaPessoa([], SEM_RESPONSAVEL, projetos)], ["c2"]);
});

test("sem nada órfão, a aba não aparece", () => {
  const abas = abasPorPessoa(
    [t("c1", "karine", "2026-10-01")],
    "/admin/lista",
    "",
    "",
    1,
    [p("c1", "karine")]
  );
  assert.ok(!abas.some((a) => a.value === SEM_RESPONSAVEL));
});

test("o href respeita a chave já presente na URL", () => {
  const abas = abasPorPessoa(
    [t("c1", "karine", "2026-10-01")],
    "/admin/lista",
    "?key=abc",
    ""
  );
  assert.equal(abas[0].href, "/admin/lista?key=abc");
  assert.equal(abas[1].href, "/admin/lista?key=abc&resp=karine");
});

test("projetosDaPessoa devolve os clientes dela", () => {
  const tarefas = [
    t("c1", "valeria", "2026-10-01"),
    t("c2", "karine", "2026-10-01"),
    t("c3", "valeria", null),
  ];
  assert.deepEqual([...projetosDaPessoa(tarefas, "valeria")], ["c1"]);
});

test("projetosDaPessoa também sabe achar o que não tem dono", () => {
  const tarefas = [t("c1", null, "2026-10-01"), t("c2", "karine", "2026-10-01")];
  assert.deepEqual([...projetosDaPessoa(tarefas, SEM_RESPONSAVEL)], ["c1"]);
});

test("respValido recusa o que não é recorte", () => {
  assert.ok(respValido("karine"));
  assert.ok(respValido(SEM_RESPONSAVEL));
  assert.ok(!respValido("jose"));
  assert.ok(!respValido(undefined));
  assert.ok(!respValido(""));
});
