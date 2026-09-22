"use client";

import { useActionState, useEffect, useState } from "react";
import { TEAM_MEMBERS_INTERNOS } from "@/lib/project-tasks";
import { SubmitButton, SubmitTextButton } from "./submit-button";
import { AutoSubmitSelect } from "./auto-submit-select";
import {
  agruparPorGrupo,
  FRENTES,
  frenteDef,
  montarMapa,
  quadranteDe,
  quadranteDef,
  QUADRANTES,
  rotuloDoGrupo,
  STATUS_INICIATIVA,
  type Frente,
  type Iniciativa,
  type IniciativaNoMapa,
} from "@/lib/prioridades";
import {
  criarIniciativaAction,
  type ResultadoCriar,
  moverIniciativaAction,
  removerIniciativaAction,
  salvarIniciativaAction,
} from "@/app/admin/prioridades/actions";

/**
 * Mapa impacto x esforço das iniciativas de melhoria (/admin/prioridades).
 *
 * O gráfico é SVG na mão, como o resto da casa (ver status-pie-board.tsx):
 * nenhuma biblioteca de gráfico entrou no projeto por causa de uma tela.
 *
 * SOBREPOSIÇÃO DE RÓTULOS — o defeito do print que a Karine mandou, onde
 * "Cobrança 30/70" cobria "Painel de casos". A solução aqui tem duas partes:
 *
 *  1. o ponto não carrega o nome: carrega um NÚMERO, e a lista embaixo abre
 *     com o mesmo número. Nome ao lado do ponto quebra sempre — com 6 itens
 *     dá pra escapar com deslocamento alternado, com 20 não dá, e é
 *     justamente quando o mapa fica útil que ele ficaria ilegível. Número
 *     ocupa um círculo de tamanho fixo, que não cresce com o texto;
 *  2. o nome aparece inteiro ao passar o mouse ou ao dar Tab no ponto, num
 *     balão que se vira sozinho pra não sair do quadro. Um nome por vez,
 *     nunca dois se cruzando.
 *
 * E o caso que numerar sozinho não resolve: duas iniciativas com o MESMO
 * impacto e esforço caem no mesmo pixel. Aí os pontos se abrem num
 * anelzinho em volta da coordenada real (ver `posicionar`), de forma
 * determinística — nada de aleatório, que daria erro de hidratação.
 */

/* -------------------------------------------------------------------------- */
/* Geometria                                                                   */
/* -------------------------------------------------------------------------- */

const VB = { w: 560, h: 440 };
const X0 = 52;
const Y0 = 28;
const X1 = 540;
const Y1 = 388;
/** Margem interna: ponto nenhum encosta na moldura, nem quando se desloca. */
const INSET = 18;
const R_PT = 13;

/**
 * Arredonda pra 3 casas. Mesmo motivo do status-pie-board: Math.cos/sin
 * podem diferir no último bit entre o V8 do servidor e o do navegador, e o
 * atributo sairia com texto diferente dos dois lados — erro de hidratação.
 */
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function px(esforco: number): number {
  return X0 + INSET + (esforco / 10) * (X1 - X0 - 2 * INSET);
}

function py(impacto: number): number {
  return Y0 + INSET + (1 - impacto / 10) * (Y1 - Y0 - 2 * INSET);
}

interface Ponto extends IniciativaNoMapa {
  cx: number;
  cy: number;
  /** true quando este ponto teve de sair do lugar exato pra não se esconder atrás de outro. */
  deslocado: boolean;
}

/**
 * Posições de todos os pontos, já com os empates abertos em anel. A ordem do
 * anel vem do número da iniciativa, então é sempre a mesma — servidor e
 * cliente desenham igual.
 */
function posicionar(itens: IniciativaNoMapa[]): Ponto[] {
  const porCelula = new Map<string, IniciativaNoMapa[]>();
  for (const i of itens) {
    const chave = `${i.impacto}|${i.esforco}`;
    const lista = porCelula.get(chave) ?? [];
    lista.push(i);
    porCelula.set(chave, lista);
  }

  return itens.map((i) => {
    const irmaos = porCelula.get(`${i.impacto}|${i.esforco}`) ?? [i];
    const n = irmaos.length;
    const k = irmaos.findIndex((x) => x.id === i.id);
    let dx = 0;
    let dy = 0;
    if (n > 1) {
      // Raio que cresce com a quantidade: com 2 pontos bastam 16px de centro
      // a centro pra eles não se tocarem; com 8, o anel precisa abrir.
      const raio = Math.max(16, ((R_PT + 1.5) * n) / Math.PI);
      const ang = -Math.PI / 2 + (k * 2 * Math.PI) / n;
      dx = raio * Math.cos(ang);
      dy = raio * Math.sin(ang);
    }
    return {
      ...i,
      cx: r3(px(i.esforco) + dx),
      cy: r3(py(i.impacto) + dy),
      deslocado: n > 1,
    };
  });
}

/** Corta o título pro balão não virar uma faixa atravessando o gráfico. */
function encurtar(texto: string, max = 40): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

/* -------------------------------------------------------------------------- */
/* Tela                                                                        */
/* -------------------------------------------------------------------------- */

export function PrioridadesBoard({
  iniciativas,
  urlKey,
}: {
  iniciativas: Iniciativa[];
  urlKey: string | null;
}) {
  // Isolar uma frente (a "legenda clicável" do print dela).
  const [isolada, setIsolada] = useState<Frente | null>(null);
  // Iniciativa sob o cursor/foco — o único nome escrito no gráfico por vez.
  const [ativo, setAtivo] = useState<string | null>(null);
  const [mostrarFeitos, setMostrarFeitos] = useState(true);
  const [abrindoNova, setAbrindoNova] = useState(false);

  // Numeração sobre a lista INTEIRA, antes de qualquer filtro: isolar uma
  // frente não renumera nada, e o #3 continua sendo o #3 no mapa todo.
  const mapa = montarMapa(iniciativas);
  const visiveis = mapa.filter((i) => mostrarFeitos || i.status !== "feito");
  const noGrafico = posicionar(visiveis);
  const naLista = visiveis.filter((i) => !isolada || i.frente === isolada);
  const grupos = agruparPorGrupo(naLista);

  // Quem é o primeiro e o último de cada grupo se calcula sobre o grupo
  // INTEIRO, não sobre o que está filtrado na tela: com uma frente isolada,
  // a seta ↓ do último visível ainda tem pra onde ir, e some só quando a
  // iniciativa é mesmo a última do quadrante. É a mesma conta que o servidor
  // faz em moverIniciativaAction — as duas pontas concordam.
  const bordas = new Map<string, { primeira: boolean; ultima: boolean }>();
  for (const g of agruparPorGrupo(visiveis)) {
    g.itens.forEach((it, i) =>
      bordas.set(it.id, {
        primeira: i === 0,
        ultima: i === g.itens.length - 1,
      })
    );
  }

  const porFrente = new Map<Frente, number>();
  for (const i of visiveis) {
    porFrente.set(i.frente, (porFrente.get(i.frente) ?? 0) + 1);
  }
  const quickWins = visiveis.filter(
    (i) => i.status !== "feito" && i.quadrante === "quick-win"
  ).length;
  const destacado = noGrafico.find((p) => p.id === ativo) ?? null;

  function aoClicarNoPonto(p: Ponto) {
    // Ponto apagado por causa do isolamento: o clique traz a frente dele de
    // volta, em vez de rolar pra uma linha que não está na tela.
    if (isolada && p.frente !== isolada) {
      setIsolada(p.frente);
      return;
    }
    setAtivo(p.id);
    document
      .getElementById(`iniciativa-${p.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------- O gráfico */}
      <section className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="text-[0.7rem] uppercase tracking-[0.14em] text-fysi-muted font-semibold">
            Impacto x esforço
          </h2>
          <span className="text-[0.7rem] text-fysi-muted">
            {visiveis.length} iniciativa{visiveis.length === 1 ? "" : "s"}
            {quickWins > 0 ? ` · ${quickWins} pra começar hoje` : ""}
          </span>
        </div>
        <p className="text-xs text-fysi-muted mb-4 max-w-2xl">
          Os números de impacto e esforço são um chute inicial nosso, pra você
          corrigir: arraste as barrinhas de cada iniciativa na lista abaixo. O
          ponto mostra o número; o nome aparece ao passar o mouse.
        </p>

        {visiveis.length === 0 ? (
          <p className="text-sm text-fysi-muted py-10 text-center">
            Nenhuma iniciativa no mapa ainda.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            className="w-full max-w-[760px] mx-auto select-none"
            role="img"
            aria-label="Iniciativas de melhoria por impacto e esforço"
          >
            {/* Fundo dos quatro quadrantes */}
            <rect
              x={X0}
              y={Y0}
              width={(X1 - X0) / 2}
              height={(Y1 - Y0) / 2}
              fill="#BFEDE0"
              opacity={0.22}
            />
            <rect
              x={(X0 + X1) / 2}
              y={Y0}
              width={(X1 - X0) / 2}
              height={(Y1 - Y0) / 2}
              fill="#F4F99D"
              opacity={0.3}
            />
            <rect
              x={X0}
              y={Y0}
              width={X1 - X0}
              height={Y1 - Y0}
              fill="none"
              stroke="var(--fysi-line-strong)"
              strokeWidth={1}
              rx={10}
            />

            {/* Rótulo de cada quadrante, no canto — os pontos passam por cima */}
            {QUADRANTES.map((q) => {
              const esquerda = q.id === "quick-win" || q.id === "filler";
              const cima = q.id === "quick-win" || q.id === "moonshot";
              return (
                <text
                  key={q.id}
                  x={esquerda ? X0 + 10 : X1 - 10}
                  y={cima ? Y0 + 17 : Y1 - 9}
                  textAnchor={esquerda ? "start" : "end"}
                  fontSize="9.5"
                  fontWeight="700"
                  letterSpacing="1.1"
                  fill={q.corRotulo}
                  opacity={0.72}
                >
                  {`${q.nome.toUpperCase()} · ${q.chamada}`}
                </text>
              );
            })}

            {/* Os cortes em 5 */}
            <line
              x1={(X0 + X1) / 2}
              y1={Y0}
              x2={(X0 + X1) / 2}
              y2={Y1}
              stroke="var(--fysi-line-strong)"
              strokeWidth={1}
              strokeDasharray="5 4"
            />
            <line
              x1={X0}
              y1={(Y0 + Y1) / 2}
              x2={X1}
              y2={(Y0 + Y1) / 2}
              stroke="var(--fysi-line-strong)"
              strokeWidth={1}
              strokeDasharray="5 4"
            />

            {/* Escala 0–10 nos dois eixos */}
            {[0, 5, 10].map((v) => (
              <text
                key={`x${v}`}
                x={r3(px(v))}
                y={Y1 + 17}
                textAnchor="middle"
                fontSize="9"
                fill="var(--fysi-muted)"
              >
                {v}
              </text>
            ))}
            {[0, 5, 10].map((v) => (
              <text
                key={`y${v}`}
                x={X0 - 9}
                y={r3(py(v)) + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--fysi-muted)"
              >
                {v}
              </text>
            ))}
            <text
              x={(X0 + X1) / 2}
              y={VB.h - 8}
              textAnchor="middle"
              fontSize="10.5"
              letterSpacing="0.6"
              fill="var(--fysi-muted)"
            >
              Esforço de construir →
            </text>
            <text
              x={16}
              y={(Y0 + Y1) / 2}
              textAnchor="middle"
              fontSize="10.5"
              letterSpacing="0.6"
              fill="var(--fysi-muted)"
              transform={`rotate(-90 16 ${(Y0 + Y1) / 2})`}
            >
              Impacto na operação ↑
            </text>

            {/* Os pontos */}
            {noGrafico.map((p) => {
              const cor = frenteDef(p.frente).cor;
              const feito = p.status === "feito";
              const apagado = isolada !== null && p.frente !== isolada;
              const emFoco = ativo === p.id;
              return (
                <g
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.titulo} — impacto ${p.impacto}, esforço ${p.esforco}, ${quadranteDef(p.quadrante).nome}`}
                  className="cursor-pointer focus:outline-none"
                  opacity={apagado ? 0.16 : feito ? 0.5 : 1}
                  onMouseEnter={() => setAtivo(p.id)}
                  onMouseLeave={() => setAtivo((a) => (a === p.id ? null : a))}
                  onFocus={() => setAtivo(p.id)}
                  onBlur={() => setAtivo((a) => (a === p.id ? null : a))}
                  onClick={() => aoClicarNoPonto(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      aoClicarNoPonto(p);
                    }
                  }}
                >
                  {/* String única no <title>: texto com vários filhos não é
                      serializado no SSR e dá erro de hidratação. */}
                  <title>{`#${p.numero} ${p.titulo} — impacto ${p.impacto}, esforço ${p.esforco}`}</title>
                  {emFoco ? (
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={R_PT + 4}
                      fill="none"
                      stroke={cor}
                      strokeWidth={1.5}
                      opacity={0.45}
                    />
                  ) : null}
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={R_PT}
                    fill={feito ? "#fff" : cor}
                    stroke={feito ? cor : "#fff"}
                    strokeWidth={feito ? 1.5 : 2}
                    strokeDasharray={feito ? "3 2" : undefined}
                  />
                  <text
                    x={p.cx}
                    y={p.cy}
                    dy="0.35em"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={feito ? cor : "#fff"}
                  >
                    {p.numero}
                  </text>
                </g>
              );
            })}

            {/* O nome — um por vez, só do ponto sob o cursor/foco */}
            {destacado ? <Balao ponto={destacado} /> : null}
          </svg>
        )}

        {/* Legenda clicável por frente */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-4 border-t border-fysi-line">
          <span className="text-[0.7rem] text-fysi-muted mr-1">
            clique pra isolar uma frente:
          </span>
          {FRENTES.map((f) => {
            const qtd = porFrente.get(f.value) ?? 0;
            const sel = isolada === f.value;
            return (
              <button
                key={f.value}
                type="button"
                disabled={qtd === 0}
                onClick={() =>
                  setIsolada((atual) => (atual === f.value ? null : f.value))
                }
                title={
                  qtd === 0
                    ? "Nenhuma iniciativa nesta frente ainda"
                    : f.descricao
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  sel
                    ? "border-fysi-deep bg-fysi-deep text-fysi-cream"
                    : "border-fysi-line text-fysi-deep hover:bg-fysi-cream"
                } ${qtd === 0 ? "opacity-40 cursor-not-allowed" : ""} ${
                  isolada && !sel ? "opacity-55" : ""
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: f.cor }}
                />
                {f.label}
                <span className="tabular-nums opacity-70">{qtd}</span>
              </button>
            );
          })}
          {isolada ? (
            <button
              type="button"
              onClick={() => setIsolada(null)}
              className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2 ml-1"
            >
              ← todas as frentes
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMostrarFeitos((v) => !v)}
            className="ml-auto text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
          >
            {mostrarFeitos ? "ocultar o que já foi feito" : "mostrar o que já foi feito"}
          </button>
        </div>
      </section>

      {/* -------------------------------------------------------- A lista */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-fysi-muted">
            {isolada
              ? `Mostrando só ${frenteDef(isolada).label}. No gráfico, as outras frentes ficam apagadas.`
              : "Agrupado pelo quadrante em que cada uma caiu. Mudar impacto ou esforço muda o grupo na hora."}
          </p>
          <button
            type="button"
            onClick={() => setAbrindoNova((v) => !v)}
            className="text-xs font-medium text-fysi-deep hover:underline"
          >
            {abrindoNova ? "cancelar" : "+ Nova iniciativa"}
          </button>
        </div>

        {abrindoNova ? (
          <FormNova urlKey={urlKey} onPronto={() => setAbrindoNova(false)} />
        ) : null}

        {grupos.length === 0 ? (
          <p className="text-sm text-fysi-muted bg-white border border-fysi-line rounded-[16px] p-6 text-center">
            Nada nesta frente ainda.
          </p>
        ) : null}

        {grupos.map(({ grupo, itens }) => {
          const rotulo = rotuloDoGrupo(grupo);
          return (
            <div
              key={grupo}
              className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-fysi-line">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${rotulo.tom}`}
                >
                  {rotulo.nome}
                </span>
                <span className="text-sm font-semibold text-fysi-deep tabular-nums">
                  {itens.length}
                </span>
                <span className="text-[0.72rem] text-fysi-muted">
                  {rotulo.descricao}
                </span>
              </div>
              {itens.map((item) => (
                <LinhaIniciativa
                  key={item.id}
                  item={item}
                  urlKey={urlKey}
                  primeira={bordas.get(item.id)?.primeira ?? true}
                  ultima={bordas.get(item.id)?.ultima ?? true}
                  emFoco={ativo === item.id}
                  onFoco={setAtivo}
                />
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Balão com o nome do ponto em foco                                           */
/* -------------------------------------------------------------------------- */

function Balao({ ponto }: { ponto: Ponto }) {
  const texto = `#${ponto.numero} ${encurtar(ponto.titulo)}`;
  // Largura estimada pelo número de caracteres — medir texto em SVG exigiria
  // ler o DOM depois de pintar, e o balão pularia de tamanho na tela.
  const largura = r3(texto.length * 5.7 + 20);
  const cabeNaDireita = ponto.cx + 20 + largura <= X1;
  const x = r3(
    cabeNaDireita ? ponto.cx + 18 : Math.max(X0 + 2, ponto.cx - 18 - largura)
  );
  const y = r3(Math.min(Math.max(ponto.cy - 11, Y0 + 2), Y1 - 24));
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={largura}
        height={22}
        rx={7}
        fill="var(--fysi-deep)"
        opacity={0.95}
      />
      <text
        x={r3(x + 10)}
        y={r3(y + 15)}
        fontSize="11"
        fontWeight="500"
        fill="var(--fysi-cream)"
      >
        {texto}
      </text>
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Uma linha da lista — é aqui que se edita                                    */
/* -------------------------------------------------------------------------- */

const CAMPO =
  "w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40";
const ROTULO =
  "text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold";
const SELECT =
  "rounded-[8px] border border-fysi-line bg-white px-2 py-1 text-xs text-fysi-deep focus:outline-none focus:border-fysi-deep/40";

function Contexto({ id, urlKey }: { id?: string; urlKey: string | null }) {
  return (
    <>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
    </>
  );
}

function LinhaIniciativa({
  item,
  urlKey,
  primeira,
  ultima,
  emFoco,
  onFoco,
}: {
  item: IniciativaNoMapa;
  urlKey: string | null;
  primeira: boolean;
  ultima: boolean;
  emFoco: boolean;
  onFoco: (id: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const frente = frenteDef(item.frente);
  const status = STATUS_INICIATIVA.find((s) => s.value === item.status);
  const dono = TEAM_MEMBERS_INTERNOS.find((m) => m.value === item.responsavel);

  return (
    <article
      id={`iniciativa-${item.id}`}
      onMouseEnter={() => onFoco(item.id)}
      onMouseLeave={() => onFoco(null)}
      className={`border-t border-fysi-line/70 px-5 py-4 transition ${
        emFoco ? "bg-fysi-cream/70" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid place-items-center h-7 w-7 shrink-0 rounded-full text-xs font-bold text-white tabular-nums"
          style={{ background: frente.cor }}
          title={`Ponto #${item.numero} no gráfico`}
        >
          {item.numero}
        </span>
        <div className="min-w-0 flex-1">
          {editando ? (
            <form
              action={salvarIniciativaAction}
              className="flex flex-col gap-2"
            >
              <Contexto id={item.id} urlKey={urlKey} />
              <label className="flex flex-col gap-1">
                <span className={ROTULO}>Título</span>
                <input
                  name="titulo"
                  required
                  maxLength={200}
                  defaultValue={item.titulo}
                  className={CAMPO}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={ROTULO}>O que é e por que importa</span>
                <textarea
                  name="detalhe"
                  rows={3}
                  defaultValue={item.detalhe ?? ""}
                  className={CAMPO}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={ROTULO}>Ganho</span>
                <input
                  name="ganho"
                  maxLength={120}
                  defaultValue={item.ganho ?? ""}
                  placeholder="Ex: -3 dias no projeto"
                  className={CAMPO}
                />
              </label>
              <div className="flex items-center gap-3">
                <SubmitButton size="sm">Salvar</SubmitButton>
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="text-xs text-fysi-muted hover:text-fysi-deep"
                >
                  fechar
                </button>
              </div>
            </form>
          ) : (
            <>
              <h3 className="text-[0.95rem] font-semibold text-fysi-deep leading-snug">
                {item.titulo}
              </h3>
              {item.detalhe ? (
                <p className="text-[0.8rem] text-fysi-muted mt-1 max-w-3xl">
                  {item.detalhe}
                </p>
              ) : null}
              {item.ganho ? (
                <p className="text-[0.78rem] text-fysi-deep mt-1.5">
                  <span className="text-fysi-muted">Ganho:</span> {item.ganho}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full text-white whitespace-nowrap"
            style={{ background: frente.cor }}
          >
            {frente.label}
          </span>
          {status ? (
            <span
              className={`text-[0.68rem] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${status.tom}`}
            >
              {status.label}
            </span>
          ) : null}
          <span className="text-[0.68rem] text-fysi-muted whitespace-nowrap">
            {dono ? dono.label : "sem dono"}
          </span>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pl-10">
        <NotasForm item={item} urlKey={urlKey} />

        <form action={salvarIniciativaAction} className="flex items-center gap-1.5">
          <Contexto id={item.id} urlKey={urlKey} />
          <span className="text-[0.7rem] text-fysi-muted">Frente</span>
          <AutoSubmitSelect
            name="frente"
            defaultValue={item.frente}
            className={SELECT}
          >
            {FRENTES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </form>

        <form action={salvarIniciativaAction} className="flex items-center gap-1.5">
          <Contexto id={item.id} urlKey={urlKey} />
          <span className="text-[0.7rem] text-fysi-muted">Dono</span>
          <AutoSubmitSelect
            name="responsavel"
            defaultValue={item.responsavel ?? ""}
            className={SELECT}
          >
            <option value="">sem dono</option>
            {TEAM_MEMBERS_INTERNOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </form>

        <form action={salvarIniciativaAction} className="flex items-center gap-1.5">
          <Contexto id={item.id} urlKey={urlKey} />
          <span className="text-[0.7rem] text-fysi-muted">Status</span>
          <AutoSubmitSelect
            name="status"
            defaultValue={item.status}
            className={SELECT}
          >
            {STATUS_INICIATIVA.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </form>

        <div className="flex items-center gap-2 ml-auto">
          {!primeira ? (
            <form action={moverIniciativaAction}>
              <Contexto id={item.id} urlKey={urlKey} />
              <input type="hidden" name="direcao" value="cima" />
              <span title="Subir no grupo">
                <SubmitTextButton>↑</SubmitTextButton>
              </span>
            </form>
          ) : null}
          {!ultima ? (
            <form action={moverIniciativaAction}>
              <Contexto id={item.id} urlKey={urlKey} />
              <input type="hidden" name="direcao" value="baixo" />
              <span title="Descer no grupo">
                <SubmitTextButton>↓</SubmitTextButton>
              </span>
            </form>
          ) : null}
          {!editando ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-xs font-medium text-fysi-deep hover:underline"
            >
              Editar
            </button>
          ) : null}
          <form action={removerIniciativaAction}>
            <Contexto id={item.id} urlKey={urlKey} />
            <SubmitTextButton
              danger
              confirm={`Remover "${item.titulo}" do mapa? Não dá pra desfazer.`}
            >
              Remover
            </SubmitTextButton>
          </form>
        </div>
      </div>
    </article>
  );
}

/**
 * Impacto e esforço numa barrinha cada. O botão só acende quando o número
 * muda — arrastar dispara um evento por pixel, e auto-submeter nisso mandaria
 * uma escrita por pixel arrastado.
 */
function NotasForm({
  item,
  urlKey,
}: {
  item: IniciativaNoMapa;
  urlKey: string | null;
}) {
  const [impacto, setImpacto] = useState(item.impacto);
  const [esforco, setEsforco] = useState(item.esforco);
  const mudou = impacto !== item.impacto || esforco !== item.esforco;
  const destino = quadranteDef(quadranteDe({ impacto, esforco }));

  return (
    <form action={salvarIniciativaAction} className="flex items-center gap-3">
      <Contexto id={item.id} urlKey={urlKey} />
      <label className="flex items-center gap-1.5">
        <span className="text-[0.7rem] text-fysi-muted">Impacto</span>
        <input
          type="range"
          name="impacto"
          min={0}
          max={10}
          step={1}
          value={impacto}
          onChange={(e) => setImpacto(Number(e.currentTarget.value))}
          className="w-20 accent-[color:var(--fysi-deep)]"
        />
        <span className="text-xs font-semibold text-fysi-deep tabular-nums w-4">
          {impacto}
        </span>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-[0.7rem] text-fysi-muted">Esforço</span>
        <input
          type="range"
          name="esforco"
          min={0}
          max={10}
          step={1}
          value={esforco}
          onChange={(e) => setEsforco(Number(e.currentTarget.value))}
          className="w-20 accent-[color:var(--fysi-deep)]"
        />
        <span className="text-xs font-semibold text-fysi-deep tabular-nums w-4">
          {esforco}
        </span>
      </label>
      {mudou ? (
        <>
          <span className="text-[0.7rem] text-fysi-muted whitespace-nowrap">
            vira {destino.nome}
          </span>
          <SubmitTextButton>Salvar números</SubmitTextButton>
        </>
      ) : null}
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Nova iniciativa                                                             */
/* -------------------------------------------------------------------------- */

function FormNova({
  urlKey,
  onPronto,
}: {
  urlKey: string | null;
  onPronto: () => void;
}) {
  // Depois de criar, o formulário FECHA. Antes ficava aberto com tudo
  // preenchido, e um segundo Enter criava a mesma iniciativa de novo.
  // Achado da revisão de 22/09. E o erro do servidor aparece aqui, em vez
  // de um "Salvo ✓" sem nada gravado.
  const [resultado, agir] = useActionState(
    async (_anterior: ResultadoCriar, fd: FormData) => criarIniciativaAction(fd),
    { ok: true, criada: false } as ResultadoCriar
  );
  useEffect(() => {
    if (resultado.ok && resultado.criada) onPronto();
  }, [resultado, onPronto]);

  return (
    <form
      action={agir}
      className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5 flex flex-col gap-3"
    >
      <Contexto urlKey={urlKey} />
      <label className="flex flex-col gap-1">
        <span className={ROTULO}>Título</span>
        <input
          name="titulo"
          required
          maxLength={200}
          placeholder="Ex: Onboarding: cliente envia informações sem a gente cobrar"
          className={CAMPO}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={ROTULO}>O que é e por que importa</span>
        <textarea name="detalhe" rows={2} className={CAMPO} />
      </label>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Frente</span>
          <select name="frente" defaultValue="producao" className={CAMPO}>
            {FRENTES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Dono</span>
          <select name="responsavel" defaultValue="" className={CAMPO}>
            <option value="">sem dono</option>
            {TEAM_MEMBERS_INTERNOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Impacto (0–10)</span>
          <input
            type="number"
            name="impacto"
            min={0}
            max={10}
            defaultValue={5}
            className={CAMPO}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Esforço (0–10)</span>
          <input
            type="number"
            name="esforco"
            min={0}
            max={10}
            defaultValue={5}
            className={CAMPO}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={ROTULO}>Ganho</span>
        <input
          name="ganho"
          maxLength={120}
          placeholder="Ex: -3 dias no projeto, mais projetos fechados/mês"
          className={CAMPO}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm">Adicionar ao mapa</SubmitButton>
        <button
          type="button"
          onClick={onPronto}
          className="text-xs text-fysi-muted hover:text-fysi-deep"
        >
          fechar
        </button>
        {!resultado.ok ? (
          <p role="alert" className="text-xs text-red-700">
            {resultado.erro}
          </p>
        ) : null}
      </div>
    </form>
  );
}
