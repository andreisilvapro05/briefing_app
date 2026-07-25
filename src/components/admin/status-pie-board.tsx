"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusChanger } from "./status-changer";

/**
 * Pizza (donut) interativa de projetos por status + lista embaixo.
 * Clicar numa fatia (ou na legenda) filtra a lista pra aquela etapa.
 */

export interface LaneClient {
  id: string;
  nome: string;
  empresa: string | null;
  tipo: string;
  status: string;
  pagamento: string;
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

function point(r: number, a: number): [number, number] {
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function annularPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = point(R, a0);
  const [ox1, oy1] = point(R, a1);
  const [ix1, iy1] = point(R_IN, a1);
  const [ix0, iy0] = point(R_IN, a0);
  return `M ${ox0} ${oy0} A ${R} ${R} 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${R_IN} ${R_IN} 0 ${large} 0 ${ix0} ${iy0} Z`;
}

export function StatusPieBoard({
  groups,
  keyParam,
  urlKey,
  novoHref,
}: {
  groups: LaneGroup[];
  keyParam: string;
  urlKey?: string;
  novoHref: string;
}) {
  const withCount = groups.filter((g) => g.clients.length > 0);
  const total = withCount.reduce((s, g) => s + g.clients.length, 0);
  const [selected, setSelected] = useState<string | null>(null);

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

  const shown = selected
    ? withCount.filter((g) => g.id === selected)
    : withCount;

  return (
    <div>
      {/* Pizza + legenda */}
      <section className="bg-white border border-fysi-line rounded-[16px] p-5 mb-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[0.7rem] uppercase tracking-[0.14em] text-fysi-muted font-semibold">
            Projetos por status
          </h2>
          <span className="text-[0.7rem] text-fysi-muted">
            {total} total · clique numa fatia pra filtrar
          </span>
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
                    <title>
                      {s.g.label}: {s.g.clients.length}
                    </title>
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
                {selected
                  ? withCount.find((g) => g.id === selected)?.clients.length ??
                    total
                  : total}
              </text>
              <text
                x={CX}
                y={CY + 14}
                textAnchor="middle"
                fontSize="8.5"
                letterSpacing="1.5"
                style={{ fill: "var(--fysi-muted)" }}
              >
                {selected ? "NESTA ETAPA" : "PROJETOS"}
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
      {selected ? (
        <div className="flex items-center gap-3 mb-3 text-sm">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-fysi-muted hover:text-fysi-deep"
          >
            ← Todos os status
          </button>
          <span className="text-fysi-deep font-medium">
            Mostrando: {withCount.find((g) => g.id === selected)?.label}
          </span>
        </div>
      ) : null}

      {/* Lista agrupada */}
      <section className="flex flex-col gap-4">
        {shown.map((g) => (
          <div
            key={g.id}
            className="bg-white border border-fysi-line rounded-[16px] overflow-hidden"
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

            <div className="hidden md:grid grid-cols-[1fr_160px_150px_90px_64px] gap-3 px-5 py-2 bg-fysi-cream/40 text-[0.62rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
              <span>Cliente</span>
              <span>Tipo</span>
              <span>Status</span>
              <span>Pagamento</span>
              <span className="text-right">Ação</span>
            </div>

            {g.clients.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-2 md:grid-cols-[1fr_160px_150px_90px_64px] gap-x-3 gap-y-1 px-5 py-3 border-t border-fysi-line/70 items-center text-sm"
              >
                <span className="font-medium text-fysi-deep truncate col-span-2 md:col-span-1">
                  {c.empresa || c.nome}
                </span>
                <span className="text-fysi-muted truncate">{c.tipo}</span>
                <span className="truncate">
                  <StatusChanger
                    clientId={c.id}
                    status={c.status || "nao-iniciado"}
                    urlKey={urlKey}
                  />
                </span>
                <span className="text-fysi-deep tabular-nums">
                  {c.pagamento}
                </span>
                <a
                  href={`/admin/${c.id}${keyParam}`}
                  className="text-right text-fysi-deep font-medium hover:underline shrink-0"
                >
                  Ver →
                </a>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
