import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MATERIAIS_PADRAO,
  STATUS_LABEL,
  dataCurtaDoMomento,
  fraseResumo,
  resumirMateriais,
  type MaterialItem,
  type MaterialStatus,
} from "../src/lib/materiais-cliente.ts";

/**
 * A regra que estas verificações protegem: o "faltam 3 de 8" ao lado do
 * cliente tem que ser VERDADE.
 *
 * Esse número não dá erro quando erra — ele só faz a equipe cobrar de novo
 * o que já chegou, ou parar de cobrar o que ainda falta. E quem lê a conta
 * é a pessoa mais exposta do fluxo: o próprio cliente, no link público.
 *
 * Todos os dados aqui são INVENTADOS. O repositório é público.
 */

let seq = 0;
/** Um item da lista. Só o que a conta olha precisa ser dito no teste. */
function item(parcial: Partial<MaterialItem> = {}): MaterialItem {
  seq += 1;
  return {
    id: `item-${seq}`,
    clientId: "cliente-de-teste",
    titulo: `Item ${seq}`,
    instrucao: null,
    ordem: seq,
    status: "pendente",
    marcadoPor: null,
    marcadoEm: null,
    recadoDoCliente: null,
    conferidoEm: null,
    conferidoPor: null,
    ...parcial,
  };
}

const pendente = () => item();
/** O cliente marcou pelo link público e ninguém da equipe conferiu ainda. */
const aConferir = () =>
  item({ status: "enviado", marcadoPor: "cliente", marcadoEm: "2026-09-22T13:00:00Z" });
/** Chegou de verdade: alguém da equipe confirmou. */
const conferido = () =>
  item({
    status: "enviado",
    marcadoPor: "cliente",
    marcadoEm: "2026-09-22T13:00:00Z",
    conferidoEm: "2026-09-22T15:00:00Z",
    conferidoPor: "equipe",
  });
const naoSeAplica = () => item({ status: "nao_se_aplica" });

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// ---------------------------------------------------------------- resumo

test("lista vazia dá zero em tudo, sem NaN nem número negativo", () => {
  const r = resumirMateriais([]);
  assert.deepEqual(r, {
    total: 0,
    faltam: 0,
    enviados: 0,
    aConferir: 0,
    naoSeAplica: 0,
  });
});

test("nenhum item some da conta, em qualquer mistura de estados", () => {
  // A invariante que segura tudo: o que entra tem que sair contado em
  // exatamente uma gaveta, e o "de 8" é só o que ainda vale.
  const itens = [
    pendente(),
    pendente(),
    aConferir(),
    conferido(),
    naoSeAplica(),
  ];
  const r = resumirMateriais(itens);
  assert.equal(r.faltam + r.enviados + r.naoSeAplica, itens.length);
  assert.equal(r.total, r.faltam + r.enviados);
  assert.ok(r.aConferir <= r.enviados, "a conferir é um recorte dos enviados");
  assert.deepEqual(r, {
    total: 4,
    faltam: 2,
    enviados: 2,
    aConferir: 1,
    naoSeAplica: 1,
  });
});

test("'não se aplica' sai da conta: não é pendência e não infla o total", () => {
  // Cliente sem site nenhum marca hospedagem e domínio como não se aplica.
  // Cobrar isso seria cobrar o que não existe, e contar no "de 8" faria a
  // lista parecer eternamente incompleta.
  const itens = [...Array(6)].map(pendente).concat([naoSeAplica(), naoSeAplica()]);
  const r = resumirMateriais(itens);
  assert.equal(r.total, 6);
  assert.equal(r.faltam, 6);
  assert.equal(r.naoSeAplica, 2);
});

test("lista inteira 'não se aplica' não deixa nenhuma pendência", () => {
  const r = resumirMateriais([naoSeAplica(), naoSeAplica(), naoSeAplica()]);
  assert.equal(r.faltam, 0);
  assert.equal(r.total, 0);
  assert.equal(r.naoSeAplica, 3);
});

test("dito pelo cliente não é chegado: enviado sem conferência fica 'a conferir'", () => {
  // É o estado do meio, e é pra ele que a feature existe. Ele não pode
  // contar como falta (o cliente já fez a parte dele) nem sumir da vista
  // da equipe (ninguém abriu o arquivo ainda).
  const r = resumirMateriais([aConferir(), pendente()]);
  assert.equal(r.faltam, 1);
  assert.equal(r.enviados, 1);
  assert.equal(r.aConferir, 1);
});

test("item conferido pela equipe sai da fila do 'a conferir'", () => {
  const r = resumirMateriais([conferido(), conferido()]);
  assert.equal(r.enviados, 2);
  assert.equal(r.aConferir, 0);
  assert.equal(r.faltam, 0);
});

test("todos pendentes: falta tudo; todos conferidos: não falta nada", () => {
  const oito = () => [...Array(8)];
  const tudoPendente = resumirMateriais(oito().map(pendente));
  assert.equal(tudoPendente.faltam, 8);
  assert.equal(tudoPendente.total, 8);
  assert.equal(tudoPendente.enviados, 0);

  const tudoEnviado = resumirMateriais(oito().map(conferido));
  assert.equal(tudoEnviado.faltam, 0);
  assert.equal(tudoEnviado.enviados, 8);
  assert.equal(tudoEnviado.total, 8);
});

test("status estranho conta como pendência, nunca desaparece da conta", () => {
  // O status vem de uma coluna de texto. Se um dia entrar um valor novo
  // (ou torto), o erro seguro é cobrar de novo — não é dar o item por
  // resolvido em silêncio.
  const itens = [item({ status: "quase_enviado" as MaterialStatus }), pendente()];
  const r = resumirMateriais(itens);
  assert.equal(r.faltam, 2);
  assert.equal(r.total, 2);
  assert.equal(r.naoSeAplica, 0);
});

// ---------------------------------------------------------------- frase

test("a frase concorda em número: 'falta 1' no singular, 'faltam N' no plural", () => {
  // Concordância errada é do tipo que ninguém volta pra corrigir, e essa
  // frase aparece ao lado do nome do cliente o dia inteiro.
  const umaFalta = resumirMateriais([pendente(), ...[...Array(7)].map(conferido)]);
  assert.equal(fraseResumo(umaFalta), "falta 1 de 8");

  const tresFaltam = resumirMateriais([
    ...[...Array(3)].map(pendente),
    ...[...Array(5)].map(conferido),
  ]);
  assert.equal(fraseResumo(tresFaltam), "faltam 3 de 8");
});

test("sem pendência a frase diz que acabou, não um 'faltam 0'", () => {
  const frase = fraseResumo(resumirMateriais([...Array(8)].map(conferido)));
  assert.ok(!frase.includes("0"), `não pode anunciar zero: "${frase}"`);
  assert.match(frase, /enviado/i);
});

test("lista vazia não vira 'faltam 0 de 0'", () => {
  assert.equal(fraseResumo(resumirMateriais([])), "Sem itens na lista");
});

test(
  "lista inteira 'não se aplica' não pode ser anunciada como lista vazia",
  () => {
    const frase = fraseResumo(resumirMateriais([naoSeAplica(), naoSeAplica()]));
    assert.notEqual(frase, fraseResumo(resumirMateriais([])));
  }
);

// ------------------------------------------------------------- data curta

test("sem data não inventa data", () => {
  assert.equal(dataCurtaDoMomento(null), "");
  assert.equal(dataCurtaDoMomento(""), "");
});

test("timestamp torto some da tela, nunca vira 'Invalid Date'", () => {
  // Mesmo defeito que já mordeu o app em setembro: `new Date` não lança
  // com lixo, devolve data inválida, e formatá-la escreve "Invalid Date"
  // na tela do cliente.
  for (const lixo of ["nao-e-data", "2026-13-45T10:00:00Z", "ontem", "22/09/2026"]) {
    const saida = dataCurtaDoMomento(lixo);
    assert.equal(saida, "", `dataCurtaDoMomento("${lixo}")`);
    assert.ok(!saida.includes("Invalid"), `"${lixo}" vazou "Invalid Date"`);
  }
});

test("timestamp válido vira dia/mês", () => {
  assert.equal(dataCurtaDoMomento("2026-09-22T13:45:00Z"), "22/09");
  assert.equal(dataCurtaDoMomento("2026-01-05T13:45:00.000Z"), "05/01");
});

test("marcado de noite não pula pro dia seguinte", () => {
  // O servidor roda em UTC. Sem o fuso de Brasília, tudo que o cliente
  // marcasse depois das 21h apareceria com a data de amanhã — e na virada
  // de ano, com o ano errado.
  assert.equal(dataCurtaDoMomento("2026-09-23T00:30:00Z"), "22/09");
  assert.equal(dataCurtaDoMomento("2027-01-01T02:00:00Z"), "31/12");
});

// ------------------------------------------------------------- constantes

test("todo status aceito pelo banco tem rótulo pra mostrar", () => {
  // Duas listas que PRECISAM concordar: o check do banco e o rótulo da
  // tela. Um status novo só no banco aparece como pill em branco.
  const dir = join(import.meta.dirname, "..", "supabase", "migrations");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .find((t) => t.includes("create table if not exists public.client_materials"));
  assert.ok(sql, "migration de client_materials não encontrada");

  const bloco = sql.slice(sql.indexOf("public.client_materials"));
  const check = /check \(status in \(([^)]*)\)\)/.exec(bloco);
  assert.ok(check, "o check de status sumiu da migration");
  const doBanco = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

  assert.deepEqual(Object.keys(STATUS_LABEL).sort(), doBanco);
  for (const [status, rotulo] of Object.entries(STATUS_LABEL)) {
    assert.ok(rotulo.trim().length > 0, `${status} sem rótulo`);
  }
  assert.equal(
    new Set(Object.values(STATUS_LABEL)).size,
    Object.keys(STATUS_LABEL).length,
    "dois status com o mesmo rótulo são indistinguíveis na tela"
  );
});

test("todo item da lista padrão tem título e instrução de verdade", () => {
  assert.ok(MATERIAIS_PADRAO.length > 0);
  for (const m of MATERIAIS_PADRAO) {
    assert.ok(m.titulo.trim().length > 0, "título vazio na lista padrão");
    assert.equal(m.titulo, m.titulo.trim(), `"${m.titulo}" com espaço sobrando`);
    // A instrução é o que o cliente lê pra saber o que mandar. Título
    // sozinho ("Textos") não diz nada a quem está do outro lado.
    assert.ok(
      m.instrucao.trim().length > 10,
      `"${m.titulo}" sem instrução que explique o que mandar`
    );
  }
});

test("nenhum título repetido na lista padrão", () => {
  // Duplicata aqui vira duplicata na tela do cliente, e as duas linhas
  // seriam marcadas separadamente — uma delas ficaria pendente pra sempre.
  const vistos = new Map<string, string>();
  for (const m of MATERIAIS_PADRAO) {
    const chave = semAcento(m.titulo);
    assert.equal(
      vistos.has(chave),
      false,
      `"${m.titulo}" repete "${vistos.get(chave)}"`
    );
    vistos.set(chave, m.titulo);
  }
});

test("instrução que manda marcar uma opção cita uma opção que existe", () => {
  // A instrução do acesso à hospedagem diz "marque não se aplica". Se o
  // rótulo for renomeado na tela, a instrução passa a mandar o cliente
  // procurar um botão que não existe mais.
  const rotulos = Object.values(STATUS_LABEL).map(semAcento);
  for (const m of MATERIAIS_PADRAO) {
    if (!semAcento(m.instrucao).includes("marque")) continue;
    const texto = semAcento(m.instrucao);
    assert.ok(
      rotulos.some((r) => texto.includes(r)),
      `"${m.titulo}" manda marcar algo que não é um rótulo da tela`
    );
  }
});
