"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  seedProjectTasksAction,
  addProjectTaskAction,
  removeProjectTaskAction,
  updateProjectTaskAction,
  reorderProjectTasksAction,
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

/** Cor da bandeira por prioridade — igual ClickUp (bandeira, sem texto ao lado). */
const TASK_PRIORITY_FLAG: Record<string, string> = {
  "": "text-fysi-line",
  urgente: "text-red-600",
  alta: "text-orange-500",
  normal: "text-blue-500",
  baixa: "text-fysi-muted",
};

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
      <circle cx="2.5" cy="2.5" r="1.4" />
      <circle cx="7.5" cy="2.5" r="1.4" />
      <circle cx="2.5" cy="8" r="1.4" />
      <circle cx="7.5" cy="8" r="1.4" />
      <circle cx="2.5" cy="13.5" r="1.4" />
      <circle cx="7.5" cy="13.5" r="1.4" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M5 3a1 1 0 0 1 1-1h11.5a1 1 0 0 1 .8 1.6L15.25 8l3.05 4.4a1 1 0 0 1-.8 1.6H7a1 1 0 0 0-1 1V21a1 1 0 1 1-2 0V3z" />
    </svg>
  );
}

/** Fecha um popover ao clicar fora dele. */
function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void
) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

/** Bandeira colorida (sem texto) — clique abre a lista de prioridades, igual ClickUp. */
function PriorityPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const current = TASK_PRIORITY_OPTIONS.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={current?.label}
        className={`w-7 h-7 rounded-md grid place-items-center hover:bg-fysi-cream transition disabled:opacity-50 ${
          TASK_PRIORITY_FLAG[value] ?? TASK_PRIORITY_FLAG[""]
        }`}
      >
        <FlagIcon />
      </button>
      {open ? (
        <div className="absolute z-20 top-full left-0 mt-1 w-40 bg-white border border-fysi-line rounded-[10px] shadow-lg py-1">
          {TASK_PRIORITY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-fysi-cream ${
                o.value === value
                  ? "font-semibold text-fysi-deep"
                  : "text-fysi-muted"
              }`}
            >
              <FlagIcon
                className={TASK_PRIORITY_FLAG[o.value] ?? TASK_PRIORITY_FLAG[""]}
              />
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Avatar só com iniciais (sem nome ao lado) — clique abre a lista da equipe, igual ClickUp. */
function AssigneePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const current = TEAM_MEMBERS.find((m) => m.value === value);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={current?.label ?? "Sem responsável"}
        className={`w-6 h-6 rounded-full grid place-items-center text-[0.58rem] font-bold text-white transition disabled:opacity-50 hover:ring-2 hover:ring-fysi-deep/15 ${
          current?.cor ?? "bg-fysi-line"
        }`}
      >
        {current?.iniciais ?? "—"}
      </button>
      {open ? (
        <div className="absolute z-20 top-full left-0 mt-1 w-44 bg-white border border-fysi-line rounded-[10px] shadow-lg py-1 max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-fysi-cream ${
              !value ? "font-semibold text-fysi-deep" : "text-fysi-muted"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-fysi-line grid place-items-center text-white text-[0.55rem]">
              —
            </span>
            Sem responsável
          </button>
          {TEAM_MEMBERS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                onChange(m.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-fysi-cream ${
                m.value === value
                  ? "font-semibold text-fysi-deep"
                  : "text-fysi-muted"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full grid place-items-center text-white text-[0.55rem] font-bold ${m.cor}`}
              >
                {m.iniciais}
              </span>
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface DragHandlers {
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isOver: boolean;
}

/**
 * Reordenação por arrastar-e-soltar (igual ClickUp) — mantém uma cópia local
 * ordenada pra feedback instantâneo e escreve no banco via
 * reorderProjectTasksAction ao soltar. Um hook por lista (cada accordion de
 * cliente na pizza tem a sua, independente das outras).
 */
export function useTaskDrag(
  tasks: ProjectTask[],
  clientId: string,
  urlKey?: string
) {
  const router = useRouter();
  const [order, setOrder] = useState(tasks);
  useEffect(() => setOrder(tasks), [tasks]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function dragProps(t: ProjectTask): DragHandlers {
    return {
      onDragStart: () => setDragId(t.id),
      onDragOver: (e) => {
        e.preventDefault();
        if (dragId && overId !== t.id) setOverId(t.id);
      },
      onDrop: () => {
        const from = order.findIndex((x) => x.id === dragId);
        const to = order.findIndex((x) => x.id === t.id);
        setDragId(null);
        setOverId(null);
        if (from === -1 || to === -1 || from === to) return;

        const next = order.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setOrder(next);

        const fd = new FormData();
        fd.append("clientId", clientId);
        if (urlKey) fd.append("key", urlKey);
        next.forEach((x) => fd.append("taskId", x.id));
        reorderProjectTasksAction(fd).then(() => router.refresh());
      },
      onDragEnd: () => {
        setDragId(null);
        setOverId(null);
      },
      isDragging: dragId === t.id,
      isOver: overId === t.id && !!dragId && dragId !== t.id,
    };
  }

  return { order, dragProps };
}

export function TaskRow({
  task,
  clientId,
  urlKey,
  clienteCell,
  drag,
}: {
  task: ProjectTask;
  clientId: string;
  urlKey?: string;
  /** Célula extra no início da linha (link pro cliente) — só a visão consolidada de /admin/tarefas usa. */
  clienteCell?: ReactNode;
  /** Handlers de drag-and-drop — só faz sentido dentro da lista de um único cliente (ver useTaskDrag). */
  drag?: DragHandlers;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [prioridade, setPrioridade] = useState(task.prioridade ?? "");
  const [responsavel, setResponsavel] = useState(task.responsavel ?? "");
  const [dataInicial, setDataInicial] = useState(task.data_inicial ?? "");
  const [dataVencimento, setDataVencimento] = useState(
    task.data_vencimento ?? ""
  );
  const [observacoes, setObservacoes] = useState(task.observacoes ?? "");
  const [expanded, setExpanded] = useState(false);
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

  const totalCols = (clienteCell ? 1 : 0) + 7;
  const fieldClass =
    "rounded-[8px] border border-transparent hover:border-fysi-line focus:border-fysi-deep/40 bg-transparent hover:bg-white focus:bg-white text-xs px-2 py-1 transition-colors focus:outline-none";

  return (
    <>
      <tr
        draggable={false}
        onDragOver={drag?.onDragOver}
        onDrop={drag?.onDrop}
        className={`group border-t border-fysi-line hover:bg-fysi-cream/40 transition-colors ${
          drag?.isDragging ? "opacity-40" : ""
        } ${drag?.isOver ? "bg-fysi-mint/20" : ""}`}
      >
        {clienteCell ? (
          <td className="px-3 py-2 text-sm text-fysi-deep">{clienteCell}</td>
        ) : null}
        <td className="px-3 py-2 text-sm text-fysi-deep">
          <div className="flex items-center gap-1.5">
            {drag ? (
              <span
                draggable
                onDragStart={drag.onDragStart}
                onDragEnd={drag.onDragEnd}
                className="text-fysi-muted/0 group-hover:text-fysi-muted hover:!text-fysi-deep cursor-grab active:cursor-grabbing shrink-0 -ml-1 transition-colors"
                title="Arrastar pra reordenar"
              >
                <GripIcon />
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-left hover:underline underline-offset-2"
              title="Ver informações da tarefa"
            >
              {task.titulo}
            </button>
          </div>
        </td>
        <td className="px-3 py-2">
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
        <td className="px-3 py-2">
          <PriorityPicker
            value={prioridade}
            disabled={pending}
            onChange={(v) => {
              setPrioridade(v);
              saveField("prioridade", v);
            }}
          />
        </td>
        <td className="px-3 py-2">
          <AssigneePicker
            value={responsavel}
            disabled={pending}
            onChange={(v) => {
              setResponsavel(v);
              saveField("responsavel", v);
            }}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="date"
            value={dataInicial}
            disabled={pending}
            onChange={(e) => setDataInicial(e.target.value)}
            onBlur={() => saveField("dataInicial", dataInicial)}
            className={fieldClass}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="date"
            value={dataVencimento}
            disabled={pending}
            onChange={(e) => setDataVencimento(e.target.value)}
            onBlur={() => saveField("dataVencimento", dataVencimento)}
            className={`${fieldClass} ${
              isOverdue(dataVencimento, status)
                ? "!border-red-300 text-red-700"
                : ""
            }`}
          />
        </td>
        <td className="px-3 py-2 text-right">
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
      {expanded ? (
        <tr className="bg-fysi-cream/30 border-t border-fysi-line">
          <td colSpan={totalCols} className="px-3 py-3">
            <div className="max-w-xl">
              <label className="block text-[0.68rem] uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1">
                Observações da tarefa
              </label>
              <textarea
                value={observacoes}
                disabled={pending}
                onChange={(e) => setObservacoes(e.target.value)}
                onBlur={() => saveField("observacoes", observacoes)}
                placeholder="Notas, links, contexto pra quem for mexer nessa tarefa…"
                rows={3}
                className="w-full rounded-[8px] border border-fysi-line bg-white text-sm px-3 py-2 focus:outline-none focus:border-fysi-deep/40 resize-y"
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
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

  const abertasSource = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "ativo"
  );
  const fechadasSource = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "fechado"
  );
  const { order: abertas, dragProps: dragAbertas } = useTaskDrag(
    abertasSource,
    clientId,
    urlKey
  );
  const { order: fechadas, dragProps: dragFechadas } = useTaskDrag(
    fechadasSource,
    clientId,
    urlKey
  );

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

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-medium text-fysi-deep">
            Tarefas do projeto
          </h3>
          {tasks.length > 0 ? (
            <p className="text-sm text-fysi-muted mt-1">
              {fechadasSource.length}/{tasks.length} fechadas
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
                  drag={abertas.length > 1 ? dragAbertas(t) : undefined}
                />
              ))}
              {mostrarFechados
                ? fechadas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={clientId}
                      urlKey={urlKey}
                      drag={
                        fechadas.length > 1 ? dragFechadas(t) : undefined
                      }
                    />
                  ))
                : null}
            </tbody>
          </table>
          {fechadasSource.length > 0 ? (
            <button
              type="button"
              onClick={() => setMostrarFechados((v) => !v)}
              className="mt-3 text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              {mostrarFechados
                ? "Ocultar fechados"
                : `Mostrar ${fechadasSource.length} fechado${fechadasSource.length === 1 ? "" : "s"}`}
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
