"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProjectTaskAction } from "@/app/admin/[id]/actions";
import {
  EISENHOWER,
  areaDe,
  esforcoDe,
  type ProjectTask,
} from "@/lib/project-tasks";
import { EisenhowerPicker } from "./task-pickers";

/**
 * As demandas internas colocadas na matriz de Eisenhower.
 *
 * Pedido da Karine (2026-09-22): "as prioridades devem funcionar para
 * tarefas internas". As demandas já carregam quadrante e tamanho desde
 * ontem — o que faltava era o lugar de OLHAR pro conjunto. Na tela de
 * Demandas elas aparecem por área, que responde "de quem é"; aqui a
 * pergunta é outra: "o que eu faço primeiro, e o que eu devia largar".
 *
 * A matriz é desenhada com os eixos escritos, igual ao seletor: o que faz
 * pensar é ver que uma demanda caiu na coluna urgente E na linha "não
 * importante" ao mesmo tempo.
 */
export function MatrizDemandas({
  demandas,
  urlKey,
}: {
  demandas: ProjectTask[];
  urlKey: string | null;
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  /** Quadrante escolhido nesta sessão — a demanda muda de caixa na hora. */
  const [movidas, setMovidas] = useState<Record<string, string>>({});

  const quadranteDe = (t: ProjectTask) => movidas[t.id] ?? t.eisenhower ?? "";

  function mover(t: ProjectTask, valor: string) {
    const anterior = quadranteDe(t);
    setMovidas((m) => ({ ...m, [t.id]: valor }));
    setErro(null);
    const fd = new FormData();
    fd.append("taskId", t.id);
    fd.append("clientId", "");
    fd.append("eisenhower", valor);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      try {
        const r = await updateProjectTaskAction(fd);
        if (!r.ok) {
          setMovidas((m) => ({ ...m, [t.id]: anterior }));
          setErro(r.erro);
          return;
        }
        router.refresh();
      } catch {
        setMovidas((m) => ({ ...m, [t.id]: anterior }));
        setErro("Não consegui salvar. Confira a conexão.");
      }
    });
  }

  const foraDaMatriz = demandas.filter((t) => !quadranteDe(t));

  if (demandas.length === 0) {
    return (
      <p className="text-sm text-fysi-muted py-10 text-center">
        Nenhuma demanda interna aberta. Elas são criadas em Demandas por área.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fysi-muted max-w-3xl">
        As demandas internas cruzadas por urgente × importante. É outra
        pergunta que a tela de Demandas: lá se vê de quem é cada uma, aqui se
        vê o que fazer primeiro — e o que dá pra largar.
      </p>

      {erro ? (
        <p role="alert" className="text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[auto_1fr_1fr] items-stretch">
        <span />
        <Eixo>Urgente</Eixo>
        <Eixo>Não urgente</Eixo>

        <EixoLateral>Importante</EixoLateral>
        <Celula q={EISENHOWER[0]} demandas={demandas} quadranteDe={quadranteDe} onMover={mover} pendente={pendente} />
        <Celula q={EISENHOWER[1]} demandas={demandas} quadranteDe={quadranteDe} onMover={mover} pendente={pendente} />

        <EixoLateral>Não importante</EixoLateral>
        <Celula q={EISENHOWER[2]} demandas={demandas} quadranteDe={quadranteDe} onMover={mover} pendente={pendente} />
        <Celula q={EISENHOWER[3]} demandas={demandas} quadranteDe={quadranteDe} onMover={mover} pendente={pendente} />
      </div>

      {foraDaMatriz.length > 0 ? (
        <section className="rounded-[16px] border border-dashed border-fysi-line p-4">
          <h2 className="text-sm font-semibold text-fysi-deep mb-1">
            Ainda sem lugar na matriz
          </h2>
          <p className="text-[0.72rem] text-fysi-muted mb-3">
            Classificar leva um clique e é o que faz a matriz valer — enquanto
            estiverem aqui, elas não entram na decisão.
          </p>
          <ul className="flex flex-col gap-1.5">
            {foraDaMatriz.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-2 rounded-[10px] border border-fysi-line bg-white px-3 py-2"
              >
                <span className="text-sm text-fysi-deep flex-1 min-w-[12rem]">
                  {t.titulo}
                </span>
                <Etiquetas task={t} />
                <EisenhowerPicker
                  value={quadranteDe(t)}
                  disabled={pendente}
                  showLabel
                  onChange={(v) => mover(t, v)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Eixo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.66rem] uppercase tracking-[0.1em] text-fysi-muted text-center pb-1">
      {children}
    </span>
  );
}

function EixoLateral({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid place-items-center px-1">
      <span className="text-[0.66rem] uppercase tracking-[0.08em] text-fysi-muted [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
        {children}
      </span>
    </span>
  );
}

function Celula({
  q,
  demandas,
  quadranteDe,
  onMover,
  pendente,
}: {
  q: (typeof EISENHOWER)[number];
  demandas: ProjectTask[];
  quadranteDe: (t: ProjectTask) => string;
  onMover: (t: ProjectTask, v: string) => void;
  pendente: boolean;
}) {
  const lista = demandas.filter((t) => quadranteDe(t) === q.value);
  return (
    <section className={`rounded-[14px] border p-3 min-h-[9rem] ${q.tom}`}>
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">{q.label}</h3>
        <span className="text-xs opacity-70 tabular-nums">{lista.length}</span>
      </div>
      <p className="text-[0.68rem] opacity-75 mb-2">{q.acao}</p>
      {lista.length === 0 ? (
        <p className="text-[0.7rem] opacity-60">Nada aqui.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lista.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-1.5 rounded-[10px] bg-white/85 border border-white px-2.5 py-1.5"
            >
              <span className="text-sm text-fysi-deep flex-1 min-w-[8rem]">
                {t.titulo}
              </span>
              <Etiquetas task={t} />
              <EisenhowerPicker
                value={quadranteDe(t)}
                disabled={pendente}
                onChange={(v) => onMover(t, v)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Área e tempo — o contexto que faz decidir sem abrir a demanda. */
function Etiquetas({ task }: { task: ProjectTask }) {
  const area = areaDe(task.area);
  const esforco = esforcoDe(task.esforco);
  return (
    <span className="flex items-center gap-1 shrink-0">
      {area ? (
        <span className={`rounded-full border px-1.5 text-[0.6rem] leading-[1.1rem] ${area.tom}`}>
          {area.label}
        </span>
      ) : null}
      {esforco ? (
        <span className={`rounded-full border px-1.5 text-[0.6rem] leading-[1.1rem] ${esforco.tom}`}>
          {esforco.curto}
        </span>
      ) : null}
    </span>
  );
}
