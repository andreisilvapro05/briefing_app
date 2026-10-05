import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorData,
  contarAtivas,
  dataDaAta,
  diaParaReferencia,
  diaValido,
  motivoDeArquivo,
  nomeDoClienteDaAta,
  ordenarPorData,
  resumoDaObservacao,
  rotuloDoDia,
  separarAtas,
  separarLinhas,
  type AtaResumo,
  type LinhaDaAta,
} from "../src/lib/atas.ts";

/** Um CLIENTE dentro de uma ata. */
const linha = (id: string, extra: Partial<LinhaDaAta> = {}): LinhaDaAta => ({
  id,
  clientId: `c-${id}`,
  cliente: "Cliente",
  statusProjeto: "design-pagina",
  observacao: null,
  ordem: 0,
  projetoArquivado: false,
  ...extra,
});

/** Uma ATA: a reunião de uma data, com clientes dentro. */
const ata = (
  id: string,
  data: string,
  extra: Partial<AtaResumo> = {}
): AtaResumo => ({
  id,
  titulo: `Reunião ${id}`,
  data,
  atualizadoEm: `${data}T10:00:00Z`,
  arquivada: false,
  linhas: [],
  ...extra,
});

/* --------------------------------------------------------------------- */
/* O pedido central: projeto finalizado some da lista, sem ser apagado   */
/* --------------------------------------------------------------------- */

test("projeto finalizado sai da lista DA ATA, sem ser apagado", () => {
  // Uma reunião com três projetos; dois terminaram desde então.
  const a = ata("reuniao", "2026-10-04", {
    linhas: [
      linha("x", { ordem: 0 }),
      linha("y", { ordem: 1, statusProjeto: "completo-entregue" }),
      linha("z", { ordem: 2, statusProjeto: "concluido" }),
    ],
  });
  const { ativas, encerradas } = separarLinhas(a.linhas);
  assert.deepEqual(ativas.map((l) => l.id), ["x"]);
  // As duas continuam na ata — a ata é registro do que foi dito naquele dia.
  assert.deepEqual(encerradas.map((l) => l.id), ["y", "z"]);
  assert.equal(ativas.length + encerradas.length, a.linhas.length);
  assert.equal(contarAtivas(a), 1);
});

test("as linhas saem na ordem em que foram puxadas", () => {
  const a = ata("r", "2026-10-04", {
    linhas: [linha("c", { ordem: 2 }), linha("a", { ordem: 0 }), linha("b", { ordem: 1 })],
  });
  assert.deepEqual(separarLinhas(a.linhas).ativas.map((l) => l.id), ["a", "b", "c"]);
});

test("motivo: finalizado e projeto arquivado são motivos diferentes", () => {
  // Um acabou bem, o outro não vai acontecer — a tela precisa distinguir.
  assert.equal(motivoDeArquivo(linha("x")), null);
  assert.equal(
    motivoDeArquivo(linha("x", { statusProjeto: "concluido" })),
    "finalizado"
  );
  assert.equal(
    motivoDeArquivo(linha("x", { projetoArquivado: true })),
    "projeto-arquivado"
  );
  // Desistência ganha: é o fato mais forte sobre o projeto.
  assert.equal(
    motivoDeArquivo(
      linha("x", { projetoArquivado: true, statusProjeto: "concluido" })
    ),
    "projeto-arquivado"
  );
});

test("status ativo em qualquer etapa mantém o cliente na ata", () => {
  for (const st of ["parado", "a-iniciar", "onboarding", "otimizacao-entrega"] as const) {
    assert.equal(
      motivoDeArquivo(linha("x", { statusProjeto: st })),
      null,
      `${st} não deveria encerrar`
    );
  }
});

test("a ata só sai da lista quando alguém a arquiva à mão", () => {
  // Diferente da LINHA: a ata inteira não some porque os projetos dela
  // terminaram — ela é o registro daquela reunião.
  const comTudoEncerrado = ata("r", "2026-10-04", {
    linhas: [linha("y", { statusProjeto: "concluido" })],
  });
  const arquivadaAMao = ata("m", "2026-10-03", { arquivada: true });
  const { ativas, arquivadas } = separarAtas([comTudoEncerrado, arquivadaAMao]);
  assert.deepEqual(ativas.map((x) => x.id), ["r"]);
  assert.deepEqual(arquivadas.map((x) => x.id), ["m"]);
});

/* --------------------------------------------------------------------- */
/* "precisa ter os documentos por datas"                                 */
/* --------------------------------------------------------------------- */

test("mais recente primeiro, e o array recebido não é reordenado", () => {
  const atas = [ata("a", "2026-09-28"), ata("b", "2026-10-04"), ata("c", "2026-10-01")];
  assert.deepEqual(ordenarPorData(atas).map((x) => x.id), ["b", "c", "a"]);
  assert.deepEqual(atas.map((x) => x.id), ["a", "b", "c"]);
});

test("mesma data: a mexida mais recentemente vem antes", () => {
  const velha = ata("velha", "2026-10-04", { atualizadoEm: "2026-10-04T08:00:00Z" });
  const nova = ata("nova", "2026-10-04", { atualizadoEm: "2026-10-04T18:00:00Z" });
  assert.deepEqual(ordenarPorData([velha, nova]).map((x) => x.id), ["nova", "velha"]);
});

test("reuniões em datas diferentes viram grupos diferentes", () => {
  const grupos = agruparPorData(
    [
      ata("hoje", "2026-10-04"),
      ata("semana", "2026-09-27"),
      ata("ontem", "2026-10-03"),
    ],
    "2026-10-04"
  );
  assert.deepEqual(grupos.map((g) => g.data), [
    "2026-10-04",
    "2026-10-03",
    "2026-09-27",
  ]);
  // Uma ata não substitui a outra: cada grupo tem a sua.
  assert.deepEqual(grupos.map((g) => g.atas.length), [1, 1, 1]);
  assert.deepEqual(grupos.map((g) => g.rotulo), ["Hoje", "Ontem", "27/09/2026"]);
});

test("atas do mesmo dia caem num grupo só", () => {
  const grupos = agruparPorData(
    [ata("a", "2026-10-04"), ata("b", "2026-10-04"), ata("c", "2026-10-01")],
    "2026-10-04"
  );
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].atas.length, 2);
  assert.equal(grupos[1].atas.length, 1);
});

test("lista vazia não vira grupo vazio", () => {
  assert.deepEqual(agruparPorData([], "2026-10-04"), []);
});

test("rótulo do dia: hoje, ontem, e data completa fora disso", () => {
  assert.equal(rotuloDoDia("2026-10-04", "2026-10-04"), "Hoje");
  assert.equal(rotuloDoDia("2026-10-03", "2026-10-04"), "Ontem");
  assert.equal(rotuloDoDia("2026-09-30", "2026-10-04"), "30/09/2026");
  // Vira o mês sem escorregar: 30/09 → 01/10 é "ontem" de verdade.
  assert.equal(rotuloDoDia("2026-09-30", "2026-10-01"), "Ontem");
  assert.equal(rotuloDoDia("", "2026-10-04"), "Sem data");
});

/* --------------------------------------------------------------------- */
/* A data gravada e lida — o lugar onde o fuso já quebrou este app antes */
/* --------------------------------------------------------------------- */

test("dia escolhido na tela volta igual depois de ir e voltar do banco", () => {
  for (const dia of ["2026-01-01", "2026-10-04", "2026-12-31"]) {
    assert.equal(dataDaAta(diaParaReferencia(dia), "2026-01-01T00:00:00Z"), dia);
  }
});

test("meia-noite UTC seria o dia anterior em Brasília — daí o meio-dia", () => {
  // Documenta por que `diaParaReferencia` usa 12:00Z: com 00:00Z a ata de
  // 4 de outubro apareceria em 3 de outubro na tela.
  assert.equal(dataDaAta("2026-10-04T00:00:00Z", ""), "2026-10-03");
  assert.equal(dataDaAta("2026-10-04T12:00:00Z", ""), "2026-10-04");
});

test("sem referencia_em cai no created_at, e data inválida não vira lixo", () => {
  assert.equal(dataDaAta(null, "2026-10-04T15:00:00Z"), "2026-10-04");
  assert.equal(dataDaAta("", "2026-10-04T15:00:00Z"), "2026-10-04");
  assert.equal(dataDaAta("nao-e-data", ""), "");
  assert.equal(dataDaAta(null, ""), "");
});

test("dia válido recusa formato torto e dia que não existe", () => {
  assert.equal(diaValido("2026-10-04"), true);
  assert.equal(diaValido("2026-02-28"), true);
  assert.equal(diaValido(""), false);
  assert.equal(diaValido("04/10/2026"), false);
  assert.equal(diaValido("2026-10-4"), false);
  // 31 de fevereiro passa no regex e `new Date` o aceitaria virando 3 de
  // março: a ata nasceria num dia que ninguém escolheu.
  assert.equal(diaValido("2026-02-31"), false);
  assert.equal(diaValido("2026-13-01"), false);
});

/* --------------------------------------------------------------------- */
/* Nome do cliente e observação                                          */
/* --------------------------------------------------------------------- */

test("nome do cliente: o escrito à mão ganha, o cadastro é o último recurso", () => {
  assert.equal(
    nomeDoClienteDaAta({
      nome_exibicao: "Katlyn Adv",
      clickup_nome: "LP Katlyn",
      empresa: "Katlyn Advocacia ME",
      nome: "Katlyn",
    }),
    "Katlyn Adv"
  );
  assert.equal(
    nomeDoClienteDaAta({ nome_exibicao: "  ", clickup_nome: "LP Katlyn", empresa: "X" }),
    "LP Katlyn"
  );
  assert.equal(nomeDoClienteDaAta({ empresa: "Fysi", nome: "Karine" }), "Fysi");
  assert.equal(nomeDoClienteDaAta({ nome: "Karine" }), "Karine");
  assert.equal(nomeDoClienteDaAta({}), "Sem nome");
});

test("observação longa é cortada sem partir palavra no meio", () => {
  assert.equal(resumoDaObservacao(null), "");
  assert.equal(resumoDaObservacao("  texto   com   espaço  "), "texto com espaço");
  const longa = `${"palavra ".repeat(30)}fim`;
  const r = resumoDaObservacao(longa, 40);
  assert.ok(r.endsWith("…"));
  assert.ok(r.length <= 41, `cortou em ${r.length}`);
  assert.ok(!r.includes("palav…"), "não deve cortar no meio da palavra");
});

test("observação sem espaço nenhum ainda é cortada", () => {
  const r = resumoDaObservacao("a".repeat(200), 20);
  assert.equal(r, `${"a".repeat(20)}…`);
});
