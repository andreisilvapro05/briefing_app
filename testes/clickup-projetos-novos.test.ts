import { test } from "node:test";
import assert from "node:assert/strict";
import {
  casarProjeto,
  normalizarNomeDeProjeto,
  statusPermiteCriar,
  type CandidatoProjeto,
} from "../src/lib/clickup-projetos-novos.ts";

/** Recorte real do banco em 28/09, com os nomes que causaram confusão. */
const CLIENTES: CandidatoProjeto[] = [
  { id: "fruteb", nomes: ["Serigy", null, "Fruteb / Sa", "Fruteb S A"] },
  { id: "babi", nomes: [null, null, "Babi Taróloga ", "Barbara Maciel Guimarães"] },
  { id: "cesar", nomes: [null, "César", "CESAR ALBUQUERQUE ADVOGADOS", "CESAR ALBUQUERQUE"], clickupTaskId: "868knuznk" },
  { id: "carla", nomes: [null, "Carla Albuquerque", "Cma Conecta", "Carla Albuquerque"], clickupTaskId: "868kx8dt8" },
  { id: "private", nomes: [null, null, "PRIVATE ODONTO CLUB ", "Fernando Pradela Correia"] },
  { id: "balen", nomes: [null, null, "Balen Susin Sociedade Individual de Advocacia", "Balen Susin Sociedade Individual de Advocacia"], arquivado: true },
];

test("normaliza tirando acento, caixa, pontuação e espaço", () => {
  assert.equal(normalizarNomeDeProjeto("Babi Taróloga "), "babitarologa");
  assert.equal(normalizarNomeDeProjeto("Fruteb / Sa"), "frutebsa");
  assert.equal(normalizarNomeDeProjeto(" Karine Serigy"), "karineserigy");
});

test("o que não existe aqui vira projeto novo", () => {
  for (const nome of ["Marplast", "Tatiana Garcia", "Javier Lopes"]) {
    assert.deepEqual(casarProjeto(nome, CLIENTES), { tipo: "criar" }, nome);
  }
});

test('"Karine Serigy" acha a Serigy que entrou como Fruteb, em vez de duplicar', () => {
  const r = casarProjeto(" Karine Serigy", CLIENTES);
  assert.equal(r.tipo, "vincular");
  assert.equal(r.tipo === "vincular" && r.clientId, "fruteb");
});

test('"Babi" acha a "Babi Taróloga"', () => {
  const r = casarProjeto("Babi", CLIENTES);
  assert.equal(r.tipo, "vincular");
  assert.equal(r.tipo === "vincular" && r.clientId, "babi");
});

test("nome igual ganha de nome parecido", () => {
  const r = casarProjeto("PRIVATE ODONTO CLUB", CLIENTES);
  assert.equal(r.tipo, "vincular");
  assert.equal(r.tipo === "vincular" && r.clientId, "private");
});

test("cliente arquivado de propósito não volta nem vira duplicata", () => {
  const r = casarProjeto("Balen Susin", CLIENTES);
  assert.equal(r.tipo, "pular");
  assert.match(r.tipo === "pular" ? r.motivo : "", /arquivado/);
});

test("quem já aponta pra outra tarefa do ClickUp não é sequestrado", () => {
  const r = casarProjeto("César", CLIENTES);
  assert.equal(r.tipo, "pular");
  assert.match(r.tipo === "pular" ? r.motivo : "", /outra tarefa/);
});

test("dois clientes com o mesmo nome: ninguém é tocado", () => {
  const ambiguos: CandidatoProjeto[] = [
    { id: "a", nomes: ["Marplast"] },
    { id: "b", nomes: ["Marplast"] },
  ];
  const r = casarProjeto("Marplast", ambiguos);
  assert.equal(r.tipo, "pular");
  assert.match(r.tipo === "pular" ? r.motivo : "", /mesmo nome/);
});

test("nome curto não casa por conter — 'Sa' não é a Fruteb / Sa", () => {
  assert.deepEqual(casarProjeto("Sa", CLIENTES), { tipo: "criar" });
});

test("só projeto em andamento nasce sozinho", () => {
  assert.equal(statusPermiteCriar("parado", "parado"), true);
  assert.equal(statusPermiteCriar("implementacao", "implementação"), true);
  assert.equal(statusPermiteCriar("concluido", "concluído"), false);
  assert.equal(statusPermiteCriar("completo-entregue", "completo| entregue"), false);
});

test('manutenção "recorrente" não vira landing page a fazer', () => {
  // O mapa manda "recorrente" pra "a-iniciar"; sem a exceção, Rogério e
  // Gerlan entrariam como projeto novo.
  assert.equal(statusPermiteCriar("a-iniciar", "recorrente"), false);
  assert.equal(statusPermiteCriar("a-iniciar", "a iniciar"), true);
});
