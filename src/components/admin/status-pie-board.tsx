"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusChanger } from "./status-changer";
import {
  TaskRow,
  useTaskDrag,
  useColumnWidths,
  ColGroup,
  ResizableTh,
  isReadOnlyFor,
  type EditRestriction,
} from "./tasks-board";
import { inicioDoPeriodo, type Periodo } from "@/lib/date-periods";
import { DEFAULT_TASK_STATUS, type ProjectTask } from "@/lib/project-tasks";

/**
 * Pizza (donut) interativa de projetos por status + lista embaixo.
 * Clicar numa fatia (ou na legenda) filtra a lista pra aquela etapa. Cada
 * linha de cliente abre/fecha (accordion) mostrando as subtarefas internas
 * com a mesma linha editável (TaskRow) usada na aba Tarefas do cliente —
 * status, prioridade, responsável e datas, igual ao ClickUp.
 */

export type LaneClientTask = ProjectTask;

export interface LaneClient {
  id: string;
  nome: string;
  empresa: string | null;
  tipo: string;
  status: string;
  pagamento: string;
  created_at: string;
  /** Progresso das subtarefas internas (fechadas/total) — null se nenhuma tarefa gerada ainda. */
  progresso: { total: number; fechadas: number } | null;
  /**
   * Subtarefas NÃO vêm do servidor — o accordion busca em
   * /api/admin/client-tasks ao abrir. `progresso` já diz se existem.
   */
  /** Sem atividade do cliente há 14+ dias — mostrado como aviso ao lado do nome, não escondendo a fase real. */
  parado: boolean;
  /** Id do documento de Estrutura Inicial do cliente, se existir — vira link no painel de informações da tarefa. */
  eiDocId: string | null;
}

export interface LaneGroup {
  id: string;
  label: string;
  color: string; // hex
  description?: string | null;
  clients: LaneClient[];
}

const R = 96;
const R_IN = 56;
const CX = 100;
const CY = 100;

// Arredonda pra 3 casas — Math.cos/sin podem diferir no último bit entre o
// V8 do servidor (Node) e o do navegador, gerando um `d` de SVG textualmente
// diferente e disparando erro de hidratação (#418) só nesta tela. Fixar a
// precisão faz a string ser idêntica dos dois lados.
function point(r: number, a: number): [number, number] {
  return [
    Math.round((CX + r * Math.cos(a)) * 1000) / 1000,
    Math.round((CY + r * Math.sin(a)) * 1000) / 1000,
  ];
}

function annularPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = point(R, a0);
  const [ox1, oy1] = point(R, a1);
  const [ix1, iy1] = point(R_IN, a1);
  const [ix0, iy0] = point(R_IN, a0);
  return `M ${ox0} ${oy0} A ${R} ${R} 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${R_IN} ${R_IN} 0 ${large} 0 ${ix0} ${iy0} Z`;
}

type PeriodoFiltro = "todos" | Periodo;

// "Esta semana" removido a pedido da Karine (2026-09-02) — projeto de
// agência não abre/fecha na semana, o filtro quase sempre ficava vazio.
const PERIODO_OPTIONS: { value: PeriodoFiltro; label: string }[] = [
  { value: "todos", label: "Todo o período" },
  { value: "mes", label: "Este mês" },
];

/** Cliente entrou dentro do período (por created_at). "todos" nunca filtra. */
function withinPeriod(createdAt: string, periodo: PeriodoFiltro): boolean {
  if (periodo === "todos") return true;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;
  return created >= inicioDoPeriodo(periodo).getTime();
}

export function StatusPieBoard({
  groups,
  keyParam,
  urlKey,
  novoHref,
  restrictToResponsavel,
}: {
  groups: LaneGroup[];
  keyParam: string;
  urlKey?: string;
  novoHref: string;
  restrictToResponsavel?: EditRestriction;
}) {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("todos");
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(clientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  const periodGroups: LaneGroup[] =
    periodo === "todos"
      ? groups
      : groups.map((g) => ({
          ...g,
          clients: g.clients.filter((c) => withinPeriod(c.created_at, periodo)),
        }));

  const withCount = periodGroups.filter((g) => g.clients.length > 0);
  const total = withCount.reduce((s, g) => s + g.clients.length, 0);

  // Segmentos do donut (começa no topo, -90°)
  let acc = 0;
  const segs = withCount.map((g) => {
    const frac = g.clients.length / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    return { g, a0, a1 };
  });

  function toggle(id: string) {
    setSelected((s) => (s === id ? null : id));
  }

  // Se o período mudou e esvaziou a lane selecionada, trata como "nenhuma
  // selecionada" em vez de mostrar um filtro apontando pra uma lane vazia.
  const selectedGroup = selected
    ? (withCount.find((g) => g.id === selected) ?? null)
    : null;

  const shown = selectedGroup ? [selectedGroup] : withCount;

  return (
    <div>
      {/* Pizza + legenda */}
      <section className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5 mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h2 className="text-[0.7rem] uppercase tracking-[0.14em] text-fysi-muted font-semibold">
            Projetos por status
          </h2>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-fysi-line bg-fysi-cream/40 p-0.5 text-[0.7rem]">
              {PERIODO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriodo(opt.value)}
                  className={`px-2.5 py-1 rounded-full font-medium transition ${
                    periodo === opt.value
                      ? "bg-fysi-deep text-fysi-cream"
                      : "text-fysi-muted hover:text-fysi-deep"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-[0.7rem] text-fysi-muted whitespace-nowrap">
              {total} total · clique numa fatia pra filtrar
            </span>
          </div>
        </div>

        {total === 0 ? (
          <p className="text-sm text-fysi-muted py-8 text-center">
            Nenhum projeto ainda.{" "}
            <Link href={novoHref} className="text-fysi-deep underline">
              Adicione o primeiro
            </Link>
            .
          </p>
        ) : (
          <div className="grid md:grid-cols-[260px_1fr] gap-6 items-center">
            <svg
              viewBox="0 0 200 200"
              className="w-full max-w-[240px] mx-auto"
              role="img"
              aria-label="Distribuição de projetos por status"
            >
              {segs.length === 1 ? (
                <circle
                  cx={CX}
                  cy={CY}
                  r={(R + R_IN) / 2}
                  fill="none"
                  stroke={segs[0].g.color}
                  strokeWidth={R - R_IN}
                  className="cursor-pointer"
                  onClick={() => toggle(segs[0].g.id)}
                />
              ) : (
                segs.map((s) => (
                  <path
                    key={s.g.id}
                    d={annularPath(s.a0, s.a1)}
                    fill={s.g.color}
                    stroke="#fff"
                    strokeWidth={2}
                    opacity={selected && selected !== s.g.id ? 0.3 : 1}
                    className="cursor-pointer transition-opacity"
                    onClick={() => toggle(s.g.id)}
                  >
                    {/* String única (não `{a}: {b}`) — texto multi-filho num
                        <title> de SVG não é serializado no SSR (vem vazio) e
                        diverge do cliente → erro de hidratação #418. */}
                    <title>{`${s.g.label}: ${s.g.clients.length}`}</title>
                  </path>
                ))
              )}
              <text
                x={CX}
                y={CY - 2}
                textAnchor="middle"
                fontSize="26"
                fontWeight="700"
                style={{ fill: "var(--fysi-deep)" }}
              >
                {selectedGroup ? selectedGroup.clients.length : total}
              </text>
              <text
                x={CX}
                y={CY + 14}
                textAnchor="middle"
                fontSize="8.5"
                letterSpacing="1.5"
                style={{ fill: "var(--fysi-muted)" }}
              >
                {selectedGroup ? "NESTA ETAPA" : "PROJETOS"}
              </text>
            </svg>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {withCount.map((g) => {
                const pct = total > 0 ? (g.clients.length / total) * 100 : 0;
                const isSel = selected === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    className={`flex items-center gap-2 text-xs rounded-md px-2 py-1 transition text-left ${
                      isSel
                        ? "bg-fysi-cream ring-1 ring-fysi-deep/15"
                        : "hover:bg-fysi-cream/60"
                    } ${selected && !isSel ? "opacity-50" : ""}`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ background: g.color }}
                    />
                    <span className="text-fysi-deep truncate flex-1">
                      {g.label}
                    </span>
                    <span className="text-fysi-muted tabular-nums shrink-0">
                      {g.clients.length} ({pct.toFixed(0)}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Barra de filtro ativo */}
      {selectedGroup ? (
        <div className="flex items-center gap-3 mb-3 text-sm">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-fysi-muted hover:text-fysi-deep"
          >
            ← Todos os status
          </button>
          <span className="text-fysi-deep font-medium">
            Mostrando: {selectedGroup.label}
          </span>
        </div>
      ) : null}

      {/* Lista agrupada */}
      <section className="flex flex-col gap-4">
        {shown.map((g) => (
          <div
            key={g.id}
            className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-fysi-line">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-white"
                style={{ background: g.color }}
              >
                {g.label}
              </span>
              <span className="text-sm font-semibold text-fysi-deep tabular-nums">
                {g.clients.length}
              </span>
              {g.description ? (
                <span className="text-[0.72rem] text-fysi-muted truncate hidden md:inline">
                  {g.description}
                </span>
              ) : null}
              <Link
                href={novoHref}
                className="ml-auto text-xs font-medium text-fysi-deep hover:underline"
              >
                + Novo projeto
              </Link>
            </div>

            <div className="hidden md:grid grid-cols-[1fr_160px_150px_90px_64px] gap-3 px-5 py-2 bg-fysi-cream/40 text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
              <span>Cliente</span>
              <span>Tipo</span>
              <span>Status</span>
              <span>Pagamento</span>
              <span className="text-right">Ação</span>
            </div>

            {g.clients.map((c) => (
              <ClientAccordionRow
                key={c.id}
                c={c}
                isOpen={expanded.has(c.id)}
                onToggle={() => toggleExpanded(c.id)}
                urlKey={urlKey}
                keyParam={keyParam}
                restrictToResponsavel={restrictToResponsavel}
              />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * Uma linha de cliente + accordion de subtarefas. Extraído do map acima pra
 * poder chamar useTaskDrag (hook) uma vez por cliente, não dentro de um
 * .map() solto.
 */
function ClientAccordionRow({
  c,
  isOpen,
  onToggle,
  urlKey,
  keyParam,
  restrictToResponsavel,
}: {
  c: LaneClient;
  isOpen: boolean;
  onToggle: () => void;
  urlKey?: string;
  keyParam: string;
  restrictToResponsavel?: EditRestriction;
}) {
  const hasTarefas = (c.progresso?.total ?? 0) > 0;
  const [carregadas, setCarregadas] = useState<LaneClientTask[] | null>(null);
  const [erroCarga, setErroCarga] = useState(false);

  // Busca as subtarefas na primeira vez que a linha é aberta.
  useEffect(() => {
    if (!isOpen || carregadas || !hasTarefas) return;
    let cancel = false;
    const q = urlKey ? `&key=${encodeURIComponent(urlKey)}` : "";
    fetch(`/api/admin/client-tasks?clientId=${encodeURIComponent(c.id)}${q}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ tarefas: LaneClientTask[] }>;
      })
      .then((d) => {
        if (!cancel) setCarregadas(d.tarefas);
      })
      .catch(() => {
        if (!cancel) setErroCarga(true);
      });
    return () => {
      cancel = true;
    };
  }, [isOpen, carregadas, hasTarefas, c.id, urlKey]);

  const { order: tarefas, dragProps } = useTaskDrag(
    carregadas ?? [],
    c.id,
    urlKey
  );
  const { widths: colWidths, total: colTotal, startResize } = useColumnWidths(
    "fysi-cols-accordion",
    [200, 160, 56, 56, 110, 120, 80]
  );

  return (
    <div className="border-t border-fysi-line/70">
      <div className="grid grid-cols-2 md:grid-cols-[1fr_160px_150px_90px_64px] gap-x-3 gap-y-1 px-5 py-3 items-center text-sm">
        <span className="flex items-center gap-1.5 col-span-2 md:col-span-1 min-w-0">
          {hasTarefas ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-label={isOpen ? "Fechar subtarefas" : "Abrir subtarefas"}
              className="text-fysi-muted hover:text-fysi-deep shrink-0 w-4"
            >
              {isOpen ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="font-medium text-fysi-deep truncate">
            {c.empresa || c.nome}
          </span>
          {c.parado ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-xs uppercase tracking-[0.08em] text-amber-700 font-medium shrink-0"
              title="Sem atividade do cliente há 14+ dias"
            >
              <span className="h-1 w-1 rounded-full bg-amber-500" />
              Parado
            </span>
          ) : null}
        </span>
        <span className="text-fysi-muted truncate">{c.tipo}</span>
        <span className="truncate flex items-center gap-2">
          <StatusChanger
            clientId={c.id}
            status={c.status || DEFAULT_TASK_STATUS}
            urlKey={urlKey}
          />
          {c.progresso && c.progresso.total > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-fysi-muted tabular-nums shrink-0 hover:text-fysi-deep hover:underline"
              title="Ver subtarefas"
            >
              {c.progresso.fechadas}/{c.progresso.total}
            </button>
          ) : null}
        </span>
        <span className="text-fysi-deep tabular-nums">{c.pagamento}</span>
        <a
          href={`/admin/${c.id}${keyParam}`}
          className="text-right text-fysi-deep font-medium hover:underline shrink-0"
        >
          Ver →
        </a>
      </div>

      {isOpen && hasTarefas && erroCarga ? (
        <div className="pl-9 pr-5 pb-3 bg-fysi-cream/30">
          <p className="text-xs text-red-600 py-2">
            Não consegui carregar as subtarefas.{" "}
            <button
              type="button"
              onClick={() => {
                setErroCarga(false);
                setCarregadas(null);
              }}
              className="underline underline-offset-2"
            >
              Tentar de novo
            </button>
          </p>
        </div>
      ) : null}

      {isOpen && hasTarefas && !erroCarga && !carregadas ? (
        <div className="pl-9 pr-5 pb-3 bg-fysi-cream/30">
          <div className="flex flex-col gap-1.5 py-2">
            {Array.from({ length: Math.min(c.progresso?.total ?? 1, 4) }).map(
              (_, i) => (
                <div
                  key={i}
                  className="h-7 rounded-[8px] bg-fysi-line/50 animate-pulse"
                />
              )
            )}
          </div>
        </div>
      ) : null}

      {isOpen && hasTarefas && carregadas ? (
        <div className="pl-9 pr-5 pb-3 bg-fysi-cream/30 overflow-x-auto">
          <table
            className="text-sm"
            style={{ width: colTotal, tableLayout: "fixed" }}
          >
            <ColGroup widths={colWidths} />
            <thead className="text-left text-xs uppercase tracking-[0.1em] text-fysi-muted">
              <tr>
                <ResizableTh onResizeStart={startResize(0)}>Nome</ResizableTh>
                <ResizableTh onResizeStart={startResize(1)}>Status</ResizableTh>
                <ResizableTh onResizeStart={startResize(2)}>Prioridade</ResizableTh>
                <ResizableTh onResizeStart={startResize(3)}>Responsável</ResizableTh>
                <ResizableTh onResizeStart={startResize(4)}>Início</ResizableTh>
                <ResizableTh onResizeStart={startResize(5)}>Vencimento</ResizableTh>
                <ResizableTh />
              </tr>
            </thead>
            <tbody>
              {tarefas.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  clientId={c.id}
                  urlKey={urlKey}
                  drag={
                    tarefas.length > 1 && !isReadOnlyFor(t, restrictToResponsavel)
                      ? dragProps(t)
                      : undefined
                  }
                  eiDocId={c.eiDocId}
                  eiHref={
                    c.eiDocId
                      ? `/admin/estruturas-iniciais/${c.eiDocId}${keyParam}`
                      : `/admin/estruturas-iniciais${keyParam}`
                  }
                  readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                />
              ))}
            </tbody>
          </table>
          <a
            href={`/admin/${c.id}?tab=tarefas${keyParam ? `&${keyParam.slice(1)}` : ""}`}
            className="inline-block mt-2 text-xs text-fysi-deep hover:underline"
          >
            Abrir na aba Tarefas →
          </a>
        </div>
      ) : null}
    </div>
  );
}
