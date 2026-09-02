"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TaskRow,
  useColumnWidths,
  ColGroup,
  ResizableTh,
  isReadOnlyFor,
  type EditRestriction,
} from "./tasks-board";
import {
  TASK_STATUS_GROUP,
  TEAM_MEMBERS,
  type ProjectTask,
} from "@/lib/project-tasks";
import type { ProjectTaskClient } from "@/lib/project-tasks-server";

type Task = ProjectTask & { client: ProjectTaskClient };

/**
 * Visão central de todas as tarefas de todos os clientes — /admin/tarefas.
 * Ver [[feedback_nao_enterrar_por_cliente]]: Tarefas existia só por cliente
 * até 2026-08-30, sem lugar pra ver o quadro todo de uma vez.
 */
export function AllTasksBoard({
  tasks,
  urlKey,
  keyParam = "",
  eiDocIdByClient = {},
  restrictToResponsavel,
}: {
  tasks: Task[];
  urlKey?: string;
  keyParam?: string;
  /** client_id -> id do documento de Estrutura Inicial, se existir. */
  eiDocIdByClient?: Record<string, string>;
  restrictToResponsavel?: EditRestriction;
}) {
  const [query, setQuery] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [mostrarFechados, setMostrarFechados] = useState(false);

  const abertasTotal = useMemo(
    () => tasks.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo"),
    [tasks]
  );
  const distribuicao = useMemo(() => {
    const porPessoa = TEAM_MEMBERS.map((m) => ({
      member: m,
      count: abertasTotal.filter((t) => t.responsavel === m.value).length,
    }));
    const semResponsavel = abertasTotal.filter((t) => !t.responsavel).length;
    return { porPessoa, semResponsavel };
  }, [abertasTotal]);

  const { widths: colWidths, total: colTotal, startResize } = useColumnWidths(
    "fysi-cols-alltasks",
    [180, 220, 150, 56, 56, 120, 130, 80]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (responsavel && t.responsavel !== responsavel) return false;
      if (!q) return true;
      const nomeCliente = (t.client.empresa || t.client.nome || "").toLowerCase();
      return (
        nomeCliente.includes(q) || t.titulo.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, responsavel]);

  const abertas = filtered.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo");
  const fechadas = filtered.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "fechado"
  );

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-medium text-fysi-deep">
            Tarefas de todos os projetos
          </h3>
          <p className="text-sm text-fysi-muted mt-1">
            {abertas.length} aberta{abertas.length === 1 ? "" : "s"} · ordenado por
            vencimento
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente ou tarefa…"
            className="rounded-[8px] border border-fysi-line bg-white text-sm px-3 py-1.5 w-56"
          />
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5"
          >
            <option value="">Todos os responsáveis</option>
            {TEAM_MEMBERS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {distribuicao.porPessoa.map(({ member, count }) => {
          const isActive = responsavel === member.value;
          return (
            <button
              key={member.value}
              type="button"
              onClick={() =>
                setResponsavel((cur) => (cur === member.value ? "" : member.value))
              }
              className={`flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1 text-xs font-medium transition ${
                isActive
                  ? "border-fysi-deep bg-fysi-deep text-fysi-cream"
                  : "border-fysi-line bg-white text-fysi-deep hover:border-fysi-deep/40"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full grid place-items-center text-[0.6rem] font-bold text-white shrink-0 ${member.cor}`}
              >
                {member.iniciais}
              </span>
              {member.label}
              <span className={isActive ? "text-fysi-cream/80" : "text-fysi-muted"}>
                {count}
              </span>
            </button>
          );
        })}
        {distribuicao.semResponsavel > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full border border-dashed border-fysi-line px-3 py-1 text-xs text-fysi-muted">
            Sem responsável
            <span className="font-medium">{distribuicao.semResponsavel}</span>
          </span>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          Nenhuma tarefa cadastrada ainda. As tarefas nascem na ficha do
          cliente, na aba Tarefas — ou de um Modelo de projeto.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          Nenhuma tarefa bate com esse filtro.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table
            className="text-sm"
            style={{ width: colTotal, tableLayout: "fixed" }}
          >
            <ColGroup widths={colWidths} />
            <thead className="text-left text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted">
              <tr>
                <ResizableTh onResizeStart={startResize(0)}>Cliente</ResizableTh>
                <ResizableTh onResizeStart={startResize(1)}>Nome</ResizableTh>
                <ResizableTh onResizeStart={startResize(2)}>Status</ResizableTh>
                <ResizableTh onResizeStart={startResize(3)}>Prioridade</ResizableTh>
                <ResizableTh onResizeStart={startResize(4)}>Responsável</ResizableTh>
                <ResizableTh onResizeStart={startResize(5)}>Data inicial</ResizableTh>
                <ResizableTh onResizeStart={startResize(6)}>Data de vencimento</ResizableTh>
                <ResizableTh />
              </tr>
            </thead>
            <tbody>
              {abertas.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  clientId={t.client_id}
                  urlKey={urlKey}
                  clienteCell={<ClienteLink client={t.client} urlKey={urlKey} />}
                  eiDocId={eiDocIdByClient[t.client_id] ?? null}
                  eiHref={
                    eiDocIdByClient[t.client_id]
                      ? `/admin/estruturas-iniciais/${eiDocIdByClient[t.client_id]}${keyParam}`
                      : `/admin/estruturas-iniciais${keyParam}`
                  }
                  readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                />
              ))}
              {mostrarFechados
                ? fechadas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={t.client_id}
                      urlKey={urlKey}
                      clienteCell={<ClienteLink client={t.client} urlKey={urlKey} />}
                      eiDocId={eiDocIdByClient[t.client_id] ?? null}
                      eiHref={
                        eiDocIdByClient[t.client_id]
                          ? `/admin/estruturas-iniciais/${eiDocIdByClient[t.client_id]}${keyParam}`
                          : `/admin/estruturas-iniciais${keyParam}`
                      }
                      readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                    />
                  ))
                : null}
            </tbody>
          </table>
          {fechadas.length > 0 ? (
            <button
              type="button"
              onClick={() => setMostrarFechados((v) => !v)}
              className="mt-3 text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              {mostrarFechados
                ? "Ocultar fechados"
                : `Mostrar ${fechadas.length} fechado${fechadas.length === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ClienteLink({
  client,
  urlKey,
}: {
  client: ProjectTaskClient;
  urlKey?: string;
}) {
  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  return (
    <Link
      href={`/admin/${client.id}${kp}`}
      className="font-medium text-fysi-deep hover:text-fysi-green underline underline-offset-2"
    >
      {client.empresa || client.nome || "Sem nome"}
    </Link>
  );
}
