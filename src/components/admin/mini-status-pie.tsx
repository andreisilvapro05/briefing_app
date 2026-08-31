"use client";

import { useState } from "react";
import Link from "next/link";
import type { LaneGroup } from "./status-pie-board";

/**
 * Pizza selecionável compacta pra Visão Geral — clica na fatia/legenda e
 * mostra a lista de nomes daquela etapa ali mesmo, sem o board completo
 * (StatusChanger, accordion de subtarefas, filtro de período) que já existe
 * na Lista por status. "Bem claro e direto" — versão resumida do mesmo
 * mecanismo, não uma cópia da tela inteira.
 */

const R = 40;
const R_IN = 24;
const CX = 48;
const CY = 48;

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

export function MiniStatusPie({
  groups,
  keyParam,
  listaHref,
}: {
  groups: LaneGroup[];
  keyParam: string;
  listaHref: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const withCount = groups.filter((g) => g.clients.length > 0);
  const total = withCount.reduce((s, g) => s + g.clients.length, 0);

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

  const selectedGroup = selected
    ? withCount.find((g) => g.id === selected)
    : null;

  if (total === 0) {
    return (
      <p className="text-sm text-fysi-muted py-8 text-center">
        Sem projetos ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
        <svg
          viewBox="0 0 96 96"
          className="w-24 h-24 shrink-0"
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
                strokeWidth={1.5}
                opacity={selected && selected !== s.g.id ? 0.35 : 1}
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
            y={CY + 5}
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            style={{ fill: "var(--fysi-deep)" }}
          >
            {selectedGroup ? selectedGroup.clients.length : total}
          </text>
        </svg>

        <div className="flex flex-col gap-1">
          {withCount.map((g) => {
            const pct = Math.round((g.clients.length / total) * 100);
            const isSel = selected === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                className={`flex items-center gap-2 text-xs rounded-md px-2 py-1 text-left transition ${
                  isSel
                    ? "bg-fysi-cream ring-1 ring-fysi-deep/15"
                    : "hover:bg-fysi-cream/60"
                } ${selected && !isSel ? "opacity-50" : ""}`}
              >
                <span
                  className="h-2 w-2 rounded-sm shrink-0"
                  style={{ background: g.color }}
                />
                <span className="text-fysi-deep truncate flex-1">
                  {g.label}
                </span>
                <span className="text-fysi-muted tabular-nums shrink-0">
                  {g.clients.length} ({pct}%)
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedGroup ? (
        <div className="border-t border-fysi-line pt-3 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-fysi-deep">
              {selectedGroup.label}
            </span>
            <Link
              href={`${listaHref}${keyParam}`}
              className="text-[0.7rem] text-fysi-deep hover:underline font-medium"
            >
              Ver detalhes →
            </Link>
          </div>
          {selectedGroup.clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin/${c.id}${keyParam}`}
              className="flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1 hover:bg-fysi-cream/60 transition"
            >
              <span className="text-fysi-deep truncate">
                {c.empresa || c.nome}
              </span>
              {c.parado ? (
                <span className="text-[0.65rem] uppercase tracking-[0.06em] text-amber-700 shrink-0">
                  parado
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
