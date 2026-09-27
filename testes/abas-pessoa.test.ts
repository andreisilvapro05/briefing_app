import { test } from "node:test";
import assert from "node:assert/strict";
import {
  abasPorPessoa,
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

const rotulos = (abas: { label: string; count: number }[]) =>
  abas.map((a) => `${a.label}:${a.count}`);

test("conta projetos, não tarefas", () => {
  const abas = abasPorPessoa(
    [
      t("c1", "valeria", "2026-10-01"),
      t("c1", "valeria", "2026-10-02"),
      t("c2", "valeria", "2026-10-03"),
    ],
    "/admin/lista",
    "",
    ""
  );
  assert.deepEqual(rotulos(abas), ["Todos:2", "Valéria:2"]);
});

test("tarefa sem prazo não entra na conta", () => {
  const abas = abasPorPessoa(
    [t("c1", "valeria", "2026-10-01"), t("c2", "valeria", null)],
    "/admin/lista",
    "",
    ""
  );
  assert.deepEqual(rotulos(abas), ["Todos:1", "Valéria:1"]);
});

test("status fechado não entra na conta", () => {
  const abas = abasPorPessoa(
    [t("c1", "valeria", "2026-10-01", "completo-entregue")],
    "/admin/lista",
    "",
    ""
  );
  assert.deepEqual(rotulos(abas), ["Todos:0"]);
});

test("pessoa sem NENHUM trabalho aberto não vira aba", () => {
  const abas = abasPorPessoa([t("c1", "karine", "2026-10-01")], "/admin/lista", "", "");
  assert.ok(!abas.some((a) => a.label === "Tainá"));
});

test("quem só tem trabalho SEM prazo aparece, com a nota", () => {
  // O caso real de 27/09: Andrei com 102 abertas, nenhuma com data.
  const abas = abasPorPessoa(
    [t("c1", "valeria", "2026-10-01"), t("c2", "andrei", null), t("c3", "andrei", null)],
    "/admin/lista",
    "",
    ""
  );
  const andrei = abas.find((a) => a.value === "andrei");
  assert.ok(andrei, "Andrei precisa aparecer, senão a barra some com ele");
  assert.equal(andrei?.count, 0, "o número segue sendo só o que tem prazo");
  assert.equal(andrei?.nota, "+2 sem prazo");
});

test("quem tem prazo e também sem prazo mostra os dois", () => {
  const abas = abasPorPessoa(
    [t("c1", "valeria", "2026-10-01"), t("c2", "valeria", null)],
    "/admin/lista",
    "",
    ""
  );
  const v = abas.find((a) => a.value === "valeria");
  assert.equal(v?.count, 1);
  assert.equal(v?.nota, "+1 sem prazo");
});

test("sem trabalho sem prazo, não há nota", () => {
  const abas = abasPorPessoa([t("c1", "valeria", "2026-10-01")], "/admin/lista", "", "");
  assert.equal(abas.find((a) => a.value === "valeria")?.nota, undefined);
});

test("mas a pessoa escolhida continua na barra mesmo zerada", () => {
  const abas = abasPorPessoa(
    [t("c1", "karine", "2026-10-01")],
    "/admin/lista",
    "",
    "taina"
  );
  assert.deepEqual(
    abas.find((a) => a.value === "taina"),
    { value: "taina", label: "Tainá", iniciais: "T", cor: "bg-amber-500", count: 0, href: "/admin/lista?resp=taina" }
  );
});

test("trabalho com prazo e sem dono ganha aba própria, por último", () => {
  const abas = abasPorPessoa(
    [t("c1", "karine", "2026-10-01"), t("c2", null, "2026-10-02")],
    "/admin/lista",
    "",
    ""
  );
  assert.deepEqual(rotulos(abas), ["Todos:2", "Karine:1", "Sem responsável:1"]);
  assert.equal(abas.at(-1)?.value, SEM_RESPONSAVEL);
  assert.equal(SEM_RESPONSAVEL, "__sem__");
});

test("sem trabalho órfão, a aba não aparece", () => {
  const abas = abasPorPessoa([t("c1", "karine", "2026-10-01")], "/admin/lista", "", "");
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
