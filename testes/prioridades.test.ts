import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorGrupo,
  CORTE,
  FRENTES,
  FRENTE_VALUES,
  frenteDef,
  grupoDe,
  GRUPOS_ORDEM,
  montarMapa,
  normalizarFrente,
  normalizarNota,
  normalizarStatus,
  quadranteDe,
  quadranteDef,
  QUADRANTES,
  rotuloDoGrupo,
  STATUS_INICIATIVA,
  type Iniciativa,
  type StatusIniciativa,
} from "../src/lib/prioridades.ts";

/**
 * O mapa impacto × esforço de /admin/prioridades.
 *
 * O que quebra calado aqui são três coisas, e são elas que estas
 * verificações seguram:
 *
 *  1. **o corte.** 5 é o valor em cima da linha tracejada. Se o cálculo e o
 *     desenho discordarem de que lado ele cai, a iniciativa aparece num
 *     quadrante no gráfico e em outro na lista embaixo — ninguém vê erro,
 *     só uma tela que se contradiz;
 *  2. **a faixa da nota.** Nota fora de 0–10 desenha ponto fora da moldura,
 *     e nota quebrada desenha ponto em coordenada `NaN`, que o SVG
 *     simplesmente não pinta: a iniciativa some do gráfico sem avisar;
 *  3. **a numeração.** O número dentro do ponto é a única ponte entre o
 *     gráfico e a lista. Se ele mudar quando se isola uma frente, o #3 da
 *     lista passa a apontar pro ponto errado.
 *
 * Todos os títulos e nomes aqui são inventados. O repositório é público.
 */

/* -------------------------------------------------------------------------- */
/* Ajudantes                                                                   */
/* -------------------------------------------------------------------------- */

let seq = 0;

/** Uma iniciativa de mentira, só com o que a regra sob teste usa. */
function ini(p: Partial<Iniciativa> & { titulo: string }): Iniciativa {
  seq += 1;
  return {
    id: p.id ?? `id-${seq}`,
    titulo: p.titulo,
    detalhe: null,
    frente: p.frente ?? "producao",
    impacto: p.impacto ?? 5,
    esforco: p.esforco ?? 5,
    ganho: null,
    responsavel: null,
    status: p.status ?? "ideia",
    ordem: p.ordem ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* O corte                                                                     */
/* -------------------------------------------------------------------------- */

test("o corte é estrito: nota 5 conta como BAIXA nos dois eixos", () => {
  // A regra escrita no módulo: "acima de 5 é alto". Quem está exatamente em
  // cima da linha fica do lado de baixo — nos dois eixos, sempre igual.
  assert.equal(quadranteDe({ impacto: 5, esforco: 5 }), "filler");
  assert.equal(quadranteDe({ impacto: 5, esforco: 10 }), "evitar");
  assert.equal(quadranteDe({ impacto: 10, esforco: 5 }), "quick-win");
  assert.equal(quadranteDe({ impacto: CORTE + 1, esforco: CORTE }), "quick-win");
  assert.equal(quadranteDe({ impacto: CORTE, esforco: CORTE + 1 }), "evitar");
});

test("a casa decimal em volta do corte não erra de lado", () => {
  // Nota gravada não é decimal (normalizarNota arredonda), mas o quadrante é
  // calculado ao vivo enquanto se arrasta o controle — e um dia alguém troca
  // o passo do controle por 0,5.
  assert.equal(quadranteDe({ impacto: 5.1, esforco: 4.9 }), "quick-win");
  assert.equal(quadranteDe({ impacto: 4.9, esforco: 5.1 }), "evitar");
  assert.equal(quadranteDe({ impacto: 4.9, esforco: 4.9 }), "filler");
  assert.equal(quadranteDe({ impacto: 5.1, esforco: 5.1 }), "moonshot");
});

test("os quatro cantos da moldura caem nos quatro quadrantes", () => {
  assert.equal(quadranteDe({ impacto: 10, esforco: 0 }), "quick-win");
  assert.equal(quadranteDe({ impacto: 10, esforco: 10 }), "moonshot");
  assert.equal(quadranteDe({ impacto: 0, esforco: 0 }), "filler");
  assert.equal(quadranteDe({ impacto: 0, esforco: 10 }), "evitar");
});

test("os quadrantes desenhados e os calculados são exatamente os mesmos", () => {
  // Invariante entre duas listas: QUADRANTES é o que a tela desenha e
  // rotula; quadranteDe é o que decide onde cada iniciativa cai. Um
  // quadrante calculado que não está na lista fica sem rótulo; um quadrante
  // da lista que nunca é calculado é uma gaveta que nunca enche.
  const calculados = new Set<string>();
  for (let impacto = 0; impacto <= 10; impacto += 1) {
    for (let esforco = 0; esforco <= 10; esforco += 1) {
      calculados.add(quadranteDe({ impacto, esforco }));
    }
  }
  const desenhados = new Set(QUADRANTES.map((q) => q.id));
  assert.deepEqual([...calculados].sort(), [...desenhados].sort());
  // E todo id desenhado tem rótulo próprio, não o do vizinho.
  for (const q of QUADRANTES) assert.equal(quadranteDef(q.id).id, q.id);
});

/* -------------------------------------------------------------------------- */
/* A nota                                                                      */
/* -------------------------------------------------------------------------- */

test("nota sempre sai inteira e dentro de 0–10, venha o que vier", () => {
  // A invariante que protege o desenho: fora dessa faixa o ponto sai da
  // moldura, e sem ser inteiro a coordenada vira um número quebrado que o
  // servidor e o navegador podem escrever diferente (erro de hidratação).
  const entradas: unknown[] = [
    0, 10, 7, -3, 99, 4.5, -0.4, 10.4, "7", "7.5", "-8", "1e9", "abc", "",
    " ", null, undefined, NaN, Infinity, -Infinity, true, false, {}, [], [3],
  ];
  for (const v of entradas) {
    const n = normalizarNota(v);
    assert.ok(Number.isInteger(n), `${String(v)} deu ${n}, que não é inteiro`);
    assert.ok(n >= 0 && n <= 10, `${String(v)} deu ${n}, fora de 0–10`);
  }
});

test("número de verdade passa inteiro, texto de número também", () => {
  assert.equal(normalizarNota(0), 0);
  assert.equal(normalizarNota(7), 7);
  assert.equal(normalizarNota(10), 10);
  assert.equal(normalizarNota("7"), 7);
  // O campo da tela é type=number sem passo: dá pra digitar 7,5.
  assert.equal(normalizarNota(7.4), 7);
  assert.equal(normalizarNota("7.5"), 8);
});

test("nota fora da faixa é puxada pra borda, não descartada", () => {
  // Quem digita 99 quis dizer "o máximo", não "some do gráfico".
  assert.equal(normalizarNota(99), 10);
  assert.equal(normalizarNota("1e9"), 10);
  assert.equal(normalizarNota(-3), 0);
  assert.equal(normalizarNota("-8"), 0);
});

test("o que não é número nenhum vira o meio da escala", () => {
  for (const v of ["abc", "7 dias", undefined, NaN, {}, Infinity]) {
    assert.equal(normalizarNota(v), 5, `${String(v)} devia virar 5`);
  }
});

test(
  "campo de nota apagado vira o meio da escala, não zero",
  () => {
    assert.equal(normalizarNota(""), 5);
    assert.equal(normalizarNota("   "), 5);
    assert.equal(normalizarNota(null), 5);
  }
);

/* -------------------------------------------------------------------------- */
/* Frente e status                                                             */
/* -------------------------------------------------------------------------- */

test("toda frente da lista sobrevive à normalização", () => {
  // Invariante entre duas listas: FRENTES é o que o seletor mostra,
  // normalizarFrente é o que o banco aceita. Frente nova que não passasse
  // por aqui seria escolhida na tela e gravada como "Produção" em silêncio.
  for (const f of FRENTES) assert.equal(normalizarFrente(f.value), f.value);
  assert.deepEqual(FRENTE_VALUES, FRENTES.map((f) => f.value));
});

test("frente inválida cai num padrão previsível, e nunca em undefined", () => {
  for (const v of ["", "  ", "Producao", "PRODUCAO", "vendas", null, undefined, 3, {}]) {
    const f = normalizarFrente(v);
    assert.equal(f, "producao", `${String(v)} devia virar "producao"`);
    assert.equal(frenteDef(f).value, f);
  }
});

test("cada frente tem rótulo e cor só dela", () => {
  // Duas frentes com a mesma cor deixam a legenda do gráfico ambígua, e
  // ninguém percebe olhando o código — só olhando a tela.
  const cores = FRENTES.map((f) => f.cor);
  assert.equal(new Set(cores).size, FRENTES.length, "duas frentes com a mesma cor");
  assert.equal(new Set(FRENTE_VALUES).size, FRENTES.length, "valor de frente repetido");
  for (const f of FRENTES) {
    assert.match(f.cor, /^#[0-9A-Fa-f]{6}$/, `cor de ${f.value} não é hex de SVG`);
    assert.ok(f.label.trim().length > 0);
    assert.equal(frenteDef(f.value).label, f.label);
  }
});

test("todo status da lista sobrevive à normalização", () => {
  // Mesma armadilha da frente: o seletor mostra STATUS_INICIATIVA, mas quem
  // decide o que é gravado é normalizarStatus. Um status novo na lista sem
  // passar por lá é escolhido como "Pausado" e salvo como "Ideia".
  for (const s of STATUS_INICIATIVA) {
    assert.equal(normalizarStatus(s.value), s.value, `status ${s.value} não volta igual`);
  }
});

test("status inválido cai em ideia", () => {
  for (const v of ["", "Feito", "arquivado", null, undefined, 0, {}]) {
    assert.equal(normalizarStatus(v), "ideia", `${String(v)} devia virar "ideia"`);
  }
});

/* -------------------------------------------------------------------------- */
/* Grupo                                                                       */
/* -------------------------------------------------------------------------- */

test("feito sai das quatro decisões, mas continua sabendo seu quadrante", () => {
  // No gráfico ele continua desenhado onde sempre esteve (apagado); só na
  // lista é que sai do meio do que ainda há pra decidir.
  const feito = { impacto: 9, esforco: 2, status: "feito" as StatusIniciativa };
  assert.equal(grupoDe(feito), "feito");
  assert.equal(quadranteDe(feito), "quick-win");
  assert.equal(grupoDe({ ...feito, status: "fazendo" }), "quick-win");
  assert.equal(grupoDe({ ...feito, status: "ideia" }), "quick-win");
});

test("todo grupo possível tem lugar na ordem da tela e rótulo próprio", () => {
  // Grupo fora de GRUPOS_ORDEM faz montarMapa DESCARTAR a iniciativa: ela
  // some da lista sem erro nenhum.
  const possiveis = new Set<string>();
  for (const status of ["ideia", "fazendo", "feito"] as StatusIniciativa[]) {
    for (let impacto = 0; impacto <= 10; impacto += 5) {
      for (let esforco = 0; esforco <= 10; esforco += 5) {
        possiveis.add(grupoDe({ impacto, esforco, status }));
      }
    }
  }
  for (const g of possiveis) assert.ok(GRUPOS_ORDEM.includes(g as never), `${g} fora da ordem`);
  for (const g of GRUPOS_ORDEM) {
    const r = rotuloDoGrupo(g);
    assert.ok(r.nome.trim().length > 0, `grupo ${g} sem nome`);
    assert.ok(r.descricao.trim().length > 0, `grupo ${g} sem descrição`);
  }
  // "Já feito" não empresta o rótulo de nenhum quadrante.
  assert.equal(rotuloDoGrupo("feito").nome, "Já feito");
});

/* -------------------------------------------------------------------------- */
/* O mapa                                                                      */
/* -------------------------------------------------------------------------- */

test("lista vazia não quebra o mapa nem os grupos", () => {
  assert.deepEqual(montarMapa([]), []);
  assert.deepEqual(agruparPorGrupo([]), []);
});

test("o mapa não perde nem duplica iniciativa", () => {
  // montarMapa reconstrói a lista filtrando grupo por grupo. Filtro que não
  // casa joga o item fora em silêncio — e a iniciativa simplesmente não
  // aparece na tela.
  const itens = [
    ini({ titulo: "Onboarding em vídeo", impacto: 9, esforco: 2 }),
    ini({ titulo: "Trocar o editor de proposta", impacto: 8, esforco: 9 }),
    ini({ titulo: "Renomear as pastas do Drive", impacto: 2, esforco: 1 }),
    ini({ titulo: "Refazer o site da agência", impacto: 3, esforco: 10 }),
    ini({ titulo: "Checklist de entrega", impacto: 7, esforco: 3, status: "feito" }),
  ];
  const mapa = montarMapa(itens);
  assert.equal(mapa.length, itens.length);
  assert.deepEqual(
    mapa.map((i) => i.id).sort(),
    itens.map((i) => i.id).sort()
  );
});

test("a numeração é 1..N, sem buraco e sem repetir", () => {
  const itens = [
    ini({ titulo: "Modelo de contrato", impacto: 6, esforco: 1 }),
    ini({ titulo: "Banco de referências", impacto: 2, esforco: 2 }),
    ini({ titulo: "Automatizar a cobrança", impacto: 9, esforco: 8 }),
    ini({ titulo: "Arrumar o e-mail de boas-vindas", impacto: 1, esforco: 9 }),
  ];
  const numeros = montarMapa(itens).map((i) => i.numero);
  assert.deepEqual(numeros, [1, 2, 3, 4]);
});

test("os grupos saem na ordem da tela: quick win primeiro, feito por último", () => {
  const itens = [
    ini({ titulo: "Já resolvido", impacto: 9, esforco: 1, status: "feito" }),
    ini({ titulo: "Caro e pouco útil", impacto: 1, esforco: 9 }),
    ini({ titulo: "Barato e pouco útil", impacto: 1, esforco: 1 }),
    ini({ titulo: "Caro e muito útil", impacto: 9, esforco: 9 }),
    ini({ titulo: "Barato e muito útil", impacto: 9, esforco: 1 }),
  ];
  assert.deepEqual(
    montarMapa(itens).map((i) => i.grupo),
    ["quick-win", "moonshot", "filler", "evitar", "feito"]
  );
  assert.deepEqual(
    agruparPorGrupo(montarMapa(itens)).map((g) => g.grupo),
    GRUPOS_ORDEM
  );
});

test("duas iniciativas com impacto e esforço IDÊNTICOS recebem números diferentes", () => {
  // Elas caem no mesmo ponto do gráfico e se abrem em anel. Se levassem o
  // mesmo número, o anel viraria dois pontos "3" e a lista embaixo teria
  // duas linhas "#3" — o gráfico deixaria de apontar pra alguma coisa.
  const itens = [
    ini({ titulo: "Primeira", impacto: 6, esforco: 6, ordem: 0 }),
    ini({ titulo: "Segunda", impacto: 6, esforco: 6, ordem: 1 }),
    ini({ titulo: "Terceira", impacto: 6, esforco: 6, ordem: 2 }),
  ];
  const numeros = montarMapa(itens).map((i) => i.numero);
  assert.equal(new Set(numeros).size, itens.length);
});

test("o número vem do mapa INTEIRO: isolar uma frente não renumera", () => {
  // É o que faz a lista embaixo casar com o ponto no gráfico. Se a
  // numeração passasse a ser feita depois do filtro, o #3 viraria #1 ao
  // clicar numa frente da legenda, e apontaria pro ponto errado.
  const itens = [
    ini({ titulo: "Onboarding em vídeo", frente: "atendimento", impacto: 9, esforco: 2, ordem: 0 }),
    ini({ titulo: "Roteiro de proposta", frente: "comercial", impacto: 8, esforco: 3, ordem: 1 }),
    ini({ titulo: "Calendário de posts", frente: "marketing", impacto: 7, esforco: 4, ordem: 2 }),
    ini({ titulo: "Reunião semanal enxuta", frente: "processos", impacto: 6, esforco: 1, ordem: 3 }),
  ];
  const mapa = montarMapa(itens);
  const calendario = mapa.find((i) => i.titulo === "Calendário de posts");
  assert.equal(calendario?.numero, 3);

  // Isolar marketing é filtrar o mapa já numerado: o #3 continua #3...
  const soMarketing = mapa.filter((i) => i.frente === "marketing");
  assert.deepEqual(soMarketing.map((i) => i.numero), [3]);

  // ...e é justamente por isso que numerar DEPOIS de filtrar seria outro
  // número. Este é o erro que a regra evita.
  const seNumerasseDepois = montarMapa(itens.filter((i) => i.frente === "marketing"));
  assert.equal(seNumerasseDepois[0].numero, 1);
});

test("mesmo 'ordem' no mesmo grupo não embaralha: desempata por título", () => {
  // Dois itens com o mesmo `ordem` acontecem de verdade (item recém-criado
  // e item que mudou de quadrante). Sem desempate firme, a lista trocaria
  // de ordem sozinha entre um carregamento e outro.
  const itens = [
    ini({ titulo: "Zapear o financeiro", impacto: 9, esforco: 2, ordem: 4 }),
    ini({ titulo: "Árvore de aprovação", impacto: 9, esforco: 2, ordem: 4 }),
    ini({ titulo: "Banco de ícones", impacto: 9, esforco: 2, ordem: 4 }),
  ];
  const titulos = montarMapa(itens).map((i) => i.titulo);
  // Acento não joga a iniciativa pro fim da fila: "Árvore" vem antes de
  // "Banco" e de "Zapear", como em qualquer lista em português.
  assert.deepEqual(titulos, ["Árvore de aprovação", "Banco de ícones", "Zapear o financeiro"]);
  // E a mesma entrada em qualquer ordem dá a mesma saída.
  assert.deepEqual(montarMapa([...itens].reverse()).map((i) => i.titulo), titulos);
});

test("'ordem' manda dentro do grupo, e só dentro dele", () => {
  // `ordem` é global no banco, mas as setas ↑↓ reordenam DENTRO do grupo.
  // Um número de ordem baixo num quadrante não pode puxar a iniciativa pra
  // frente de um quadrante anterior.
  const itens = [
    ini({ titulo: "Filler com ordem 0", impacto: 1, esforco: 1, ordem: 0 }),
    ini({ titulo: "Quick win com ordem 99", impacto: 9, esforco: 1, ordem: 99 }),
    ini({ titulo: "Quick win com ordem 100", impacto: 8, esforco: 2, ordem: 100 }),
  ];
  assert.deepEqual(montarMapa(itens).map((i) => i.titulo), [
    "Quick win com ordem 99",
    "Quick win com ordem 100",
    "Filler com ordem 0",
  ]);
});

test("agrupar não inventa grupo vazio nem esconde iniciativa", () => {
  const itens = [
    ini({ titulo: "Uma só", impacto: 9, esforco: 1 }),
    ini({ titulo: "Outra igual", impacto: 8, esforco: 2 }),
  ];
  const grupos = agruparPorGrupo(montarMapa(itens));
  assert.deepEqual(grupos.map((g) => g.grupo), ["quick-win"]);
  assert.equal(
    grupos.reduce((t, g) => t + g.itens.length, 0),
    itens.length
  );
});

test("os números de cada grupo são um trecho contínuo, na ordem em que a lista desce", () => {
  // A lista é desenhada grupo por grupo, e cada linha abre com o número do
  // ponto. Se os números de um grupo não fossem um trecho contínuo e
  // crescente, a tela leria "#1 #4 #2" dentro do mesmo cabeçalho — e a
  // primeira leitura seria "faltou iniciativa".
  const itens = [
    ini({ titulo: "Onboarding em vídeo", impacto: 9, esforco: 2, ordem: 1 }),
    ini({ titulo: "Modelo de proposta", impacto: 8, esforco: 1, ordem: 0 }),
    ini({ titulo: "Trocar o CRM", impacto: 9, esforco: 9, ordem: 0 }),
    ini({ titulo: "Renomear pastas", impacto: 2, esforco: 2, ordem: 0 }),
    ini({ titulo: "Refazer o site", impacto: 2, esforco: 9, ordem: 0 }),
    ini({ titulo: "Checklist de entrega", impacto: 7, esforco: 2, status: "feito" }),
  ];
  const grupos = agruparPorGrupo(montarMapa(itens));
  let esperado = 1;
  for (const g of grupos) {
    for (const i of g.itens) {
      assert.equal(i.numero, esperado, `${i.titulo} quebrou a sequência do grupo ${g.grupo}`);
      esperado += 1;
    }
  }
  assert.equal(esperado - 1, itens.length, "a sequência não cobriu a lista inteira");
});

test("reordenar dentro do grupo se mantém na próxima montagem da tela", () => {
  // A seta ↑↓ não guarda posição: ela regrava `ordem` como 0,1,2… dentro do
  // grupo e deixa a tela remontar pelo mesmo montarMapa. Se o desempate por
  // título passasse por cima de `ordem`, a seta pareceria não fazer nada —
  // clica, a página recarrega, e a linha volta pro lugar de antes.
  const itens = [
    ini({ titulo: "Aprovação em uma etapa", impacto: 9, esforco: 2, ordem: 3 }),
    ini({ titulo: "Briefing guiado", impacto: 8, esforco: 1, ordem: 7 }),
    ini({ titulo: "Catálogo de blocos", impacto: 7, esforco: 3, ordem: 11 }),
  ];
  const antes = montarMapa(itens).map((i) => i.titulo);
  assert.deepEqual(antes, ["Aprovação em uma etapa", "Briefing guiado", "Catálogo de blocos"]);

  // O que a ação faz ao subir a terceira: troca com a vizinha de cima e
  // regrava o grupo inteiro em 0,1,2…
  const grupo = montarMapa(itens);
  const pos = grupo.findIndex((i) => i.titulo === "Catálogo de blocos");
  const novo = [...grupo];
  [novo[pos - 1], novo[pos]] = [novo[pos], novo[pos - 1]];
  const regravado: Iniciativa[] = novo.map((i, idx) => ({ ...i, ordem: idx }));

  assert.deepEqual(montarMapa(regravado).map((i) => i.titulo), [
    "Aprovação em uma etapa",
    "Catálogo de blocos",
    "Briefing guiado",
  ]);
  // E subir não mexeu em quem não foi tocado: a primeira continua a primeira.
  assert.equal(montarMapa(regravado)[0].numero, 1);
});
