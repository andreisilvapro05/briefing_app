"use client";

import { Fragment, useMemo, useState } from "react";
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
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  TEAM_MEMBERS,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectTaskClient } from "@/lib/project-tasks-server";
import { TaskComposer } from "./task-composer";
import type { ClientOption } from "./task-pickers";

/** Esta tela agrupa POR cliente, então demanda interna (client null) é
 * filtrada antes de chegar aqui — ver /admin/tarefas. */
type Task = ProjectTask & { client: ProjectTaskClient; client_id: string };

/**
 * Visão central de todas as tarefas de todos os clientes — /admin/tarefas.
 * Ver [[feedback_nao_enterrar_por_cliente]]: Tarefas existia só por cliente
 * até 2026-08-30, sem lugar pra ver o quadro todo de uma vez.
 */
export function AllTasksBoard({
  tasks,
  urlKey,
  clients = [],
  restrictToResponsavel,
}: {
  tasks: Task[];
  urlKey?: string;
  /** Clientes visíveis pra pessoa — opções do "+ Nova tarefa". */
  clients?: ClientOption[];
  restrictToResponsavel?: EditRestriction;
}) {
  const [query, setQuery] = useState("");
  const [criando, setCriando] = useState(false);
  // "Agrupar por" é como o ClickUp organiza a lista — sem isso, 130 tarefas
  // de 30 clientes viram uma tabela plana em que nada salta.
  const [agruparPor, setAgruparPor] = useState<Agrupamento>("status");
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
    [168, 232, 182, 74, 74, 92, 124, 40]
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
  const grupos = useMemo(
    () => agrupar(abertas, agruparPor),
    // `abertas` é derivado de `filtered`, que já é memoizado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, agruparPor]
  );
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
          <label className="inline-flex items-center gap-1.5 text-sm text-fysi-muted">
            Agrupar por
            <select
              value={agruparPor}
              onChange={(e) => setAgruparPor(e.target.value as Agrupamento)}
              className="rounded-[8px] border border-fysi-line bg-white text-sm px-2 py-1.5 text-fysi-deep"
            >
              <option value="status">Status</option>
              <option value="responsavel">Responsável</option>
              <option value="cliente">Cliente</option>
              <option value="nenhum">Nada</option>
            </select>
          </label>
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
          {/* "basico" sem vínculo não cria (o servidor recusaria). */}
          {restrictToResponsavel === null ? null : (
            <button
              type="button"
              onClick={() => setCriando((v) => !v)}
              aria-expanded={criando}
              className={`inline-flex items-center rounded-full text-sm font-semibold px-4 h-9 transition ${
                criando
                  ? "border border-fysi-line text-fysi-muted hover:text-fysi-deep"
                  : "bg-fysi-deep text-fysi-cream hover:bg-fysi-deep/90"
              }`}
            >
              {criando ? "Fechar" : "+ Nova tarefa"}
            </button>
          )}
        </div>
      </div>

      {criando ? (
        <div className="mb-4">
          <TaskComposer
            clients={clients}
            defaultResponsavel={
              typeof restrictToResponsavel === "string"
                ? restrictToResponsavel
                : responsavel
            }
            lockResponsavel={typeof restrictToResponsavel === "string"}
            urlKey={urlKey}
            autoFocus
            onClose={() => setCriando(false)}
            notaInterno="Demanda interna não entra nesta lista (ela é por cliente) — aparece em Meu Trabalho."
          />
        </div>
      ) : null}

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
          Nenhuma tarefa cadastrada ainda. Crie a primeira em &ldquo;+ Nova
          tarefa&rdquo;, ou gere o checklist padrão na aba Tarefas da ficha
          do cliente.
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
                <ResizableTh onResizeStart={startResize(3)} title="Prioridade">Prior.</ResizableTh>
                <ResizableTh onResizeStart={startResize(4)} title="Responsável">Resp.</ResizableTh>
                <ResizableTh onResizeStart={startResize(5)}>Início</ResizableTh>
                <ResizableTh onResizeStart={startResize(6)}>Vencimento</ResizableTh>
                <ResizableTh />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.chave}>
                  {g.titulo ? (
                    <tr className="border-t border-fysi-line">
                      <th
                        colSpan={8}
                        scope="colgroup"
                        className="bg-fysi-cream/60 px-3 py-1.5 text-left"
                      >
                        <span className="inline-flex items-center gap-2">
                          {g.tom ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${g.tom}`}
                            >
                              {g.titulo}
                            </span>
                          ) : (
                            <span className="text-[0.78rem] font-semibold text-fysi-deep">
                              {g.titulo}
                            </span>
                          )}
                          <span className="text-xs text-fysi-muted">
                            {g.tarefas.length}
                          </span>
                        </span>
                      </th>
                    </tr>
                  ) : null}
                  {g.tarefas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={t.client_id}
                      urlKey={urlKey}
                      clienteCell={<ClienteLink client={t.client} urlKey={urlKey} />}
                      readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                    />
                  ))}
                </Fragment>
              ))}
              {mostrarFechados
                ? fechadas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={t.client_id}
                      urlKey={urlKey}
                      clienteCell={<ClienteLink client={t.client} urlKey={urlKey} />}
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

type Agrupamento = "status" | "responsavel" | "cliente" | "nenhum";

interface Grupo {
  chave: string;
  /** null = sem cabeçalho (agrupamento "nada"). */
  titulo: string | null;
  /** Classe da pílula, quando o grupo é um status. */
  tom: string | null;
  tarefas: Task[];
}

/**
 * Agrupa a lista como o "Group by" do ClickUp. A ordem dos grupos segue a
 * ordem canônica do estágio (TASK_STATUS_OPTIONS), não a alfabética — ler
 * "A iniciar" antes de "Implementação" é o fluxo real do projeto.
 */
function agrupar(tarefas: Task[], por: Agrupamento): Grupo[] {
  if (por === "nenhum") {
    return [{ chave: "todas", titulo: null, tom: null, tarefas }];
  }

  const mapa = new Map<string, Task[]>();
  for (const t of tarefas) {
    const k =
      por === "status"
        ? t.status
        : por === "responsavel"
          ? (t.responsavel ?? "")
          : t.client_id;
    const arr = mapa.get(k);
    if (arr) arr.push(t);
    else mapa.set(k, [t]);
  }

  const grupos: Grupo[] = [];
  if (por === "status") {
    for (const o of TASK_STATUS_OPTIONS) {
      const arr = mapa.get(o.value);
      if (arr?.length) {
        grupos.push({
          chave: o.value,
          titulo: o.label,
          tom: TASK_STATUS_TONE[o.value as TaskStatus],
          tarefas: arr,
        });
      }
    }
    return grupos;
  }

  if (por === "responsavel") {
    for (const m of TEAM_MEMBERS) {
      const arr = mapa.get(m.value);
      if (arr?.length) {
        grupos.push({ chave: m.value, titulo: m.label, tom: null, tarefas: arr });
      }
    }
    const semDono = mapa.get("");
    if (semDono?.length) {
      grupos.push({
        chave: "sem-dono",
        titulo: "Sem responsável",
        tom: null,
        tarefas: semDono,
      });
    }
    return grupos;
  }

  // Cliente: alfabético, que é como se procura um nome.
  return Array.from(mapa.entries())
    .map(([clientId, arr]) => ({
      chave: clientId,
      titulo: arr[0].client.empresa || arr[0].client.nome || "Sem nome",
      tom: null,
      tarefas: arr,
    }))
    .sort((a, b) => (a.titulo ?? "").localeCompare(b.titulo ?? "", "pt-BR"));
}
