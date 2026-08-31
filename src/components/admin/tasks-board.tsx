"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  seedProjectTasksAction,
  addProjectTaskAction,
  removeProjectTaskAction,
  updateProjectTaskAction,
  reorderProjectTasksAction,
  getProjectTaskCommentsAction,
  addProjectTaskCommentAction,
  deleteProjectTaskCommentAction,
  type ProjectTaskComment,
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

/**
 * Larguras de coluna editáveis por arrastar a borda — persistidas por
 * viewer em localStorage (chave por tabela, já que Tarefas do cliente,
 * Tarefas de todos os projetos e o accordion da pizza têm colunas
 * diferentes). Começa nos defaults (server e client renderizam igual, sem
 * mismatch de hidratação) e só troca pro valor salvo depois de montar.
 */
export function useColumnWidths(storageKey: string, defaults: number[]) {
  const [widths, setWidths] = useState<number[]>(defaults);
  const widthsRef = useRef(widths);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === defaults.length) {
          widthsRef.current = parsed;
          setWidths(parsed);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch {}
  }, [storageKey]);

  function startResize(index: number) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = widthsRef.current[index];
      function onMove(ev: MouseEvent) {
        const next = widthsRef.current.slice();
        next[index] = Math.max(48, startWidth + (ev.clientX - startX));
        widthsRef.current = next;
        setWidths(next);
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
        } catch {}
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  const total = widths.reduce((s, w) => s + w, 0);
  return { widths, total, startResize };
}

export function ColGroup({ widths }: { widths: number[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

/** Cabeçalho de coluna com a alça de redimensionar na borda direita. */
export function ResizableTh({
  children,
  onResizeStart,
  className = "",
}: {
  children?: ReactNode;
  onResizeStart?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <th className={`relative px-3 py-2 font-medium ${className}`}>
      <span className="truncate block pr-2">{children}</span>
      {onResizeStart ? (
        <span
          onMouseDown={onResizeStart}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-fysi-deep/15 active:bg-fysi-deep/25 select-none"
        />
      ) : null}
    </th>
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
  eiDocId,
  eiHref,
}: {
  task: ProjectTask;
  clientId: string;
  urlKey?: string;
  /** Célula extra no início da linha (link pro cliente) — só a visão consolidada de /admin/tarefas usa. */
  clienteCell?: ReactNode;
  /** Handlers de drag-and-drop — só faz sentido dentro da lista de um único cliente (ver useTaskDrag). */
  drag?: DragHandlers;
  /** null = cliente ainda não tem Estrutura Inicial (link leva pro hub em vez do documento). */
  eiDocId?: string | null;
  eiHref?: string;
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
          <td className="px-3 py-2 text-sm text-fysi-deep overflow-hidden truncate">
            {clienteCell}
          </td>
        ) : null}
        <td className="px-3 py-2 text-sm text-fysi-deep overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
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
              className="text-left hover:underline underline-offset-2 truncate min-w-0"
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
            className={`max-w-full rounded-full border text-xs font-medium px-2.5 py-1 cursor-pointer focus:outline-none disabled:opacity-50 ${TASK_STATUS_TONE[status]}`}
          >
            {TASK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2 overflow-hidden">
          <PriorityPicker
            value={prioridade}
            disabled={pending}
            onChange={(v) => {
              setPrioridade(v);
              saveField("prioridade", v);
            }}
          />
        </td>
        <td className="px-3 py-2 overflow-hidden">
          <AssigneePicker
            value={responsavel}
            disabled={pending}
            onChange={(v) => {
              setResponsavel(v);
              saveField("responsavel", v);
            }}
          />
        </td>
        <td className="px-3 py-2 overflow-hidden">
          <input
            type="date"
            value={dataInicial}
            disabled={pending}
            onChange={(e) => setDataInicial(e.target.value)}
            onBlur={() => saveField("dataInicial", dataInicial)}
            className={`max-w-full ${fieldClass}`}
          />
        </td>
        <td className="px-3 py-2 overflow-hidden">
          <input
            type="date"
            value={dataVencimento}
            disabled={pending}
            onChange={(e) => setDataVencimento(e.target.value)}
            onBlur={() => saveField("dataVencimento", dataVencimento)}
            className={`max-w-full ${fieldClass} ${
              isOverdue(dataVencimento, status)
                ? "!border-red-300 text-red-700"
                : ""
            }`}
          />
        </td>
        <td className="px-3 py-2 text-right overflow-hidden">
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
          <td colSpan={totalCols} className="px-3 py-4">
            <div className="max-w-xl flex flex-col gap-4">
              {eiHref ? (
                <Link
                  href={eiHref}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-fysi-deep hover:underline w-fit"
                >
                  📐 {eiDocId ? "Ver Estrutura Inicial" : "Criar Estrutura Inicial"} →
                </Link>
              ) : null}

              <div>
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

              <TaskComments taskId={task.id} clientId={clientId} urlKey={urlKey} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function TaskComments({
  taskId,
  clientId,
  urlKey,
}: {
  taskId: string;
  clientId: string;
  urlKey?: string;
}) {
  const [comments, setComments] = useState<ProjectTaskComment[] | null>(null);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getProjectTaskCommentsAction(taskId, urlKey).then((data) => {
      if (active) setComments(data);
    });
    return () => {
      active = false;
    };
  }, [taskId, urlKey]);

  function refresh() {
    getProjectTaskCommentsAction(taskId, urlKey).then(setComments);
  }

  function submit() {
    const value = body.trim();
    if (!value) return;
    const fd = new FormData();
    fd.append("taskId", taskId);
    fd.append("clientId", clientId);
    fd.append("body", value);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await addProjectTaskCommentAction(fd);
      setBody("");
      refresh();
    });
  }

  function remove(commentId: string) {
    const fd = new FormData();
    fd.append("commentId", commentId);
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await deleteProjectTaskCommentAction(fd);
      refresh();
    });
  }

  return (
    <div>
      <label className="block text-[0.68rem] uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1">
        Comentários
      </label>
      {comments === null ? (
        <p className="text-xs text-fysi-muted">Carregando…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-fysi-muted mb-2">Nenhum comentário ainda.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-2 max-h-56 overflow-y-auto">
          {comments.map((c) => (
            <div
              key={c.id}
              className="group/comment bg-white border border-fysi-line rounded-[8px] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-medium text-fysi-deep">
                  {c.author}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[0.65rem] text-fysi-muted tabular-nums">
                    {formatCommentDate(c.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="text-[0.65rem] text-red-700 opacity-0 group-hover/comment:opacity-100 hover:underline disabled:opacity-50"
                  >
                    excluir
                  </button>
                </span>
              </div>
              <p className="text-xs text-fysi-deep whitespace-pre-wrap">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escrever um comentário…"
          rows={2}
          className="flex-1 rounded-[8px] border border-fysi-line bg-white text-xs px-3 py-2 focus:outline-none focus:border-fysi-deep/40 resize-y"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={submit}
          disabled={pending || !body.trim()}
        >
          Comentar
        </Button>
      </div>
    </div>
  );
}

function formatCommentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TasksBoard({
  clientId,
  urlKey,
  projectType,
  tasks,
  eiDocId,
  eiHref,
}: {
  clientId: string;
  urlKey?: string;
  projectType: ProjectType | null;
  tasks: ProjectTask[];
  eiDocId?: string | null;
  eiHref?: string;
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
  const { widths: colWidths, total: colTotal, startResize } = useColumnWidths(
    "fysi-cols-tasksboard",
    [220, 150, 56, 56, 120, 130, 80]
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
          <table
            className="text-sm"
            style={{ width: colTotal, tableLayout: "fixed" }}
          >
            <ColGroup widths={colWidths} />
            <thead className="text-left text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted">
              <tr>
                <ResizableTh onResizeStart={startResize(0)}>Nome</ResizableTh>
                <ResizableTh onResizeStart={startResize(1)}>Status</ResizableTh>
                <ResizableTh onResizeStart={startResize(2)}>Prioridade</ResizableTh>
                <ResizableTh onResizeStart={startResize(3)}>Responsável</ResizableTh>
                <ResizableTh onResizeStart={startResize(4)}>Data inicial</ResizableTh>
                <ResizableTh onResizeStart={startResize(5)}>Data de vencimento</ResizableTh>
                <ResizableTh />
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
                  eiDocId={eiDocId}
                  eiHref={eiHref}
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
                      eiDocId={eiDocId}
                      eiHref={eiHref}
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
