"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  seedProjectTasksAction,
  addProjectTaskAction,
  removeProjectTaskAction,
  updateProjectTaskAction,
} from "@/app/admin/[id]/actions";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  TASK_STATUS_GROUP,
  TASK_PRIORITY_OPTIONS,
  TEAM_MEMBERS,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectType } from "@/lib/types";

/** Data (YYYY-MM-DD) já passou e a tarefa não está num status "fechado". */
function isOverdue(dataVencimento: string, status: TaskStatus): boolean {
  if (!dataVencimento) return false;
  if (TASK_STATUS_GROUP[status] === "fechado") return false;
  const hoje = new Date().toISOString().slice(0, 10);
  return dataVencimento < hoje;
}

export function TaskRow({
  task,
  clientId,
  urlKey,
  clienteCell,
}: {
  task: ProjectTask;
  clientId: string;
  urlKey?: string;
  /** Célula extra no início da linha (link pro cliente) — só a visão consolidada de /admin/tarefas usa. */
  clienteCell?: ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [prioridade, setPrioridade] = useState(task.prioridade ?? "");
  const [responsavel, setResponsavel] = useState(task.responsavel ?? "");
  const [dataInicial, setDataInicial] = useState(task.data_inicial ?? "");
  const [dataVencimento, setDataVencimento] = useState(
    task.data_vencimento ?? ""
  );
  const [pending, startTransition] = useTransition();

  function baseFd() {
    const fd = new FormData();
    fd.append("taskId", task.id);
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    return fd;
  }

  function saveField(field: string, value: string) {
    const fd = baseFd();
    fd.append(field, value);
    startTransition(async () => {
      await updateProjectTaskAction(fd);
      router.refresh();
    });
  }

  function remove() {
    const fd = baseFd();
    startTransition(async () => {
      await removeProjectTaskAction(fd);
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-fysi-line">
      {clienteCell ? (
        <td className="px-3 py-2.5 text-sm text-fysi-deep">{clienteCell}</td>
      ) : null}
      <td className="px-3 py-2.5 text-sm text-fysi-deep">{task.titulo}</td>
      <td className="px-3 py-2.5">
        <select
          value={status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as TaskStatus;
            setStatus(next);
            saveField("status", next);
          }}
          className={`rounded-full border text-xs font-medium px-2.5 py-1 cursor-pointer focus:outline-none disabled:opacity-50 ${TASK_STATUS_TONE[status]}`}
        >
          {TASK_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <select
          value={prioridade}
          disabled={pending}
          onChange={(e) => {
            setPrioridade(e.target.value);
            saveField("prioridade", e.target.value);
          }}
          className="rounded-[8px] border border-fysi-line bg-white text-xs px-2 py-1"
        >
          {TASK_PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <select
          value={responsavel}
          disabled={pending}
          onChange={(e) => {
            setResponsavel(e.target.value);
            saveField("responsavel", e.target.value);
          }}
          className="rounded-[8px] border border-fysi-line bg-white text-xs px-2 py-1"
        >
          <option value="">Sem responsável</option>
          {TEAM_MEMBERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <input
          type="date"
          value={dataInicial}
          disabled={pending}
          onChange={(e) => setDataInicial(e.target.value)}
          onBlur={() => saveField("dataInicial", dataInicial)}
          className="rounded-[8px] border border-fysi-line bg-white text-xs px-2 py-1"
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="date"
          value={dataVencimento}
          disabled={pending}
          onChange={(e) => setDataVencimento(e.target.value)}
          onBlur={() => saveField("dataVencimento", dataVencimento)}
          className={`rounded-[8px] border bg-white text-xs px-2 py-1 ${
            isOverdue(dataVencimento, status)
              ? "border-red-300 text-red-700"
              : "border-fysi-line"
          }`}
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-xs text-red-700 underline underline-offset-2 disabled:opacity-50"
        >
          Remover
        </button>
      </td>
    </tr>
  );
}

export function TasksBoard({
  clientId,
  urlKey,
  projectType,
  tasks,
}: {
  clientId: string;
  urlKey?: string;
  projectType: ProjectType | null;
  tasks: ProjectTask[];
}) {
  const router = useRouter();
  const [novoTitulo, setNovoTitulo] = useState("");
  const [mostrarFechados, setMostrarFechados] = useState(false);
  const [pending, startTransition] = useTransition();

  function seed() {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await seedProjectTasksAction(fd);
      router.refresh();
    });
  }

  function add() {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("titulo", titulo);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await addProjectTaskAction(fd);
      setNovoTitulo("");
      router.refresh();
    });
  }

  const abertas = tasks.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo");
  const fechadas = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "fechado"
  );

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-medium text-fysi-deep">
            Tarefas do projeto
          </h3>
          {tasks.length > 0 ? (
            <p className="text-sm text-fysi-muted mt-1">
              {fechadas.length}/{tasks.length} fechadas
            </p>
          ) : null}
        </div>
        {tasks.length === 0 && projectType ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={seed}
            disabled={pending}
          >
            {pending ? "Gerando…" : "Gerar tarefas do template"}
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          {projectType
            ? 'Nenhuma tarefa ainda. Clique em "Gerar tarefas do template" pra criar o checklist padrão deste tipo de projeto.'
            : "Defina o tipo de projeto (na Visão geral) antes de gerar as tarefas."}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-left text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Prioridade</th>
                <th className="px-3 py-2 font-medium">Responsável</th>
                <th className="px-3 py-2 font-medium">Data inicial</th>
                <th className="px-3 py-2 font-medium">Data de vencimento</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {abertas.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  clientId={clientId}
                  urlKey={urlKey}
                />
              ))}
              {mostrarFechados
                ? fechadas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={clientId}
                      urlKey={urlKey}
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

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-fysi-line">
        <input
          type="text"
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="Nova tarefa…"
          className="flex-1 rounded-[8px] border border-fysi-line bg-white text-sm px-3 py-1.5"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={add}
          disabled={pending || !novoTitulo.trim()}
        >
          + Adicionar
        </Button>
      </div>
    </section>
  );
}
