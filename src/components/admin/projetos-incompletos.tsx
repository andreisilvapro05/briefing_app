"use client";

import { useActionState, useMemo, useState } from "react";
import { ajustarProjetoAction } from "@/app/admin/lista/actions";
import { PROJECT_TYPE_OPTIONS } from "@/lib/project-types";
import {
  AJUSTE_INICIAL,
  faltasEmTexto,
  pendenciasDoProjeto,
  projetoIncompleto,
  type PendenciasProjeto,
} from "@/lib/projetos-incompletos";
import { SubmitButton } from "./submit-button";
import { Caret, useGruposColapsados } from "./use-grupos-colapsados";
import type { LaneClient, LaneGroup } from "./status-pie-board";

/**
 * Painel "Projetos incompletos" — os projetos que nasceram pela metade:
 * sem tipo de projeto e/ou sem o checklist de tarefas do modelo.
 *
 * Por que aqui, no topo de /admin/lista: foi nesta tela que o problema
 * apareceu (coluna TIPO com "—"), é a visão central de TODOS os projetos e
 * as mesmas linhas já ganham a pílula "Incompleto" logo abaixo. Enterrar
 * isso na ficha de cada cliente obrigaria a abrir 43 fichas pra descobrir
 * quais estão furadas (ver [[feedback_nao_enterrar_por_cliente]]).
 *
 * Nada é corrigido sozinho: o painel mostra o que falta e deixa resolver
 * ali mesmo, um projeto por vez, no clique da equipe.
 *
 * Custo zero de banco: tudo é derivado dos mesmos `groups` que a pizza já
 * recebe — nenhuma consulta nova.
 */

type Ordenacao = "gravidade" | "antigos" | "recentes" | "nome";

const ORDENACOES: { value: Ordenacao; label: string }[] = [
  { value: "gravidade", label: "O que falta" },
  { value: "antigos", label: "Mais antigos" },
  { value: "recentes", label: "Mais recentes" },
  { value: "nome", label: "Nome (A → Z)" },
];

interface ProjetoIncompleto {
  cliente: LaneClient;
  pendencias: PendenciasProjeto;
  laneLabel: string;
  laneColor: string;
}

/** Quanto mais falta, mais alto — define a ordem "O que falta". */
function peso(p: PendenciasProjeto): number {
  return (p.semTipo ? 2 : 0) + (p.semChecklist ? 2 : 0) + (p.checklistParcial ? 1 : 0);
}

function nomeDe(c: LaneClient): string {
  return c.empresa?.trim() || c.nome || "(sem nome)";
}

export function ProjetosIncompletos({
  groups,
  keyParam,
  urlKey,
}: {
  groups: LaneGroup[];
  keyParam: string;
  urlKey?: string;
}) {
  const [ordem, setOrdem] = useState<Ordenacao>("gravidade");
  const painel = useGruposColapsados("fysi-painel-incompletos");

  const incompletos = useMemo<ProjetoIncompleto[]>(() => {
    const lista: ProjetoIncompleto[] = [];
    for (const g of groups) {
      for (const cliente of g.clients) {
        const pendencias = pendenciasDoProjeto({
          projectType: cliente.projectType,
          totalTarefas: cliente.progresso?.total ?? 0,
        });
        if (!projetoIncompleto(pendencias)) continue;
        lista.push({
          cliente,
          pendencias,
          laneLabel: g.label,
          laneColor: g.color,
        });
      }
    }
    return lista;
  }, [groups]);

  const ordenados = useMemo(() => {
    const copia = [...incompletos];
    copia.sort((a, b) => {
      if (ordem === "nome") {
        return nomeDe(a.cliente).localeCompare(nomeDe(b.cliente), "pt-BR");
      }
      if (ordem === "antigos" || ordem === "recentes") {
        const da = new Date(a.cliente.created_at).getTime() || 0;
        const db = new Date(b.cliente.created_at).getTime() || 0;
        return ordem === "antigos" ? da - db : db - da;
      }
      const dif = peso(b.pendencias) - peso(a.pendencias);
      if (dif !== 0) return dif;
      return nomeDe(a.cliente).localeCompare(nomeDe(b.cliente), "pt-BR");
    });
    return copia;
  }, [incompletos, ordem]);

  if (incompletos.length === 0) {
    return (
      <section className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card px-5 py-3 mb-5 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-fysi-mint-vivid shrink-0" />
        <p className="text-sm text-fysi-muted">
          Todos os projetos têm tipo e checklist de tarefas.
        </p>
      </section>
    );
  }

  const fechado = painel.fechado("painel");

  return (
    <section className="bg-white border border-sky-200 rounded-[16px] shadow-fysi-card mb-5 overflow-hidden">
      <div
        className={`flex flex-wrap items-center gap-3 px-5 py-3.5 bg-sky-50/60 ${
          fechado ? "" : "border-b border-sky-200"
        }`}
      >
        <button
          type="button"
          onClick={() => painel.alternar("painel")}
          aria-expanded={!fechado}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left group/cab"
        >
          <span className="text-sky-700 group-hover/cab:text-fysi-deep">
            <Caret aberto={!fechado} />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-white">
            Projetos incompletos
          </span>
          <span className="text-sm font-semibold text-fysi-deep tabular-nums">
            {incompletos.length}
          </span>
          <span className="text-[0.72rem] text-fysi-muted truncate hidden md:inline">
            nasceram sem tipo de projeto e/ou sem o checklist de tarefas
          </span>
        </button>

        {fechado ? null : (
          <label className="flex items-center gap-2 text-[0.72rem] text-fysi-muted shrink-0">
            Ordenar por
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordenacao)}
              className="rounded-[8px] border border-fysi-line bg-white px-2 py-1 text-xs text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
            >
              {ORDENACOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {fechado ? null : (
        <>
          <p className="px-5 pt-3 text-[0.78rem] text-fysi-muted">
            Escolha o tipo e mande gerar o checklist. Nada é criado sem você
            mandar, e gerar duas vezes não duplica tarefa.
          </p>
          <ul className="flex flex-col">
            {ordenados.map((item) => (
              <LinhaIncompleta
                key={item.cliente.id}
                item={item}
                keyParam={keyParam}
                urlKey={urlKey}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function LinhaIncompleta({
  item,
  keyParam,
  urlKey,
}: {
  item: ProjetoIncompleto;
  keyParam: string;
  urlKey?: string;
}) {
  const { cliente, pendencias } = item;
  const [estado, formAction] = useActionState(
    ajustarProjetoAction,
    AJUSTE_INICIAL
  );
  const faltas = faltasEmTexto(pendencias);

  return (
    <li className="border-t border-fysi-line/70 px-5 py-3">
      <form
        action={formAction}
        className="grid gap-x-4 gap-y-2 md:grid-cols-[1fr_auto] items-start"
      >
        <input type="hidden" name="clientId" value={cliente.id} />
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/admin/${cliente.id}${keyParam}`}
              className="text-sm font-medium text-fysi-deep hover:underline underline-offset-2 truncate"
            >
              {nomeDe(cliente)}
            </a>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-white shrink-0"
              style={{ background: item.laneColor }}
            >
              {item.laneLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {faltas.map((falta) => (
              <span
                key={falta}
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[0.7rem] text-sky-800"
              >
                <span className="h-1 w-1 rounded-full bg-sky-500" />
                {falta}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <label className="sr-only" htmlFor={`tipo-${cliente.id}`}>
            Tipo de projeto de {nomeDe(cliente)}
          </label>
          <select
            id={`tipo-${cliente.id}`}
            name="projectType"
            required
            defaultValue={cliente.projectType ?? ""}
            className={`rounded-[10px] border bg-white px-2.5 py-1.5 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40 ${
              pendencias.semTipo ? "border-sky-300" : "border-fysi-line"
            }`}
          >
            <option value="" disabled>
              — escolher o tipo —
            </option>
            {PROJECT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 text-[0.78rem] text-fysi-deep">
            <input
              type="checkbox"
              name="gerarChecklist"
              defaultChecked={pendencias.semChecklist || pendencias.checklistParcial}
              className="h-3.5 w-3.5 rounded border-fysi-line accent-fysi-deep"
            />
            gerar checklist
          </label>

          <SubmitButton size="sm" variant="secondary" pendingLabel="Ajustando…">
            Ajustar
          </SubmitButton>
        </div>

        {estado.mensagem && estado.clientId === cliente.id ? (
          <p
            className={`md:col-span-2 text-[0.78rem] ${
              estado.ok ? "text-fysi-deep" : "text-red-700"
            }`}
            role="status"
          >
            {estado.ok ? "Pronto — " : ""}
            {estado.mensagem}
          </p>
        ) : null}
      </form>
    </li>
  );
}
