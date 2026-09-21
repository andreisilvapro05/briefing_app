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
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectType } from "@/lib/types";
import {
  AssigneePicker,
  DueDatePicker,
  PriorityPicker,
  hojeISO,
} from "./task-pickers";
import { TaskComposer } from "./task-composer";

/** Data (YYYY-MM-DD) já passou e a tarefa não está num status "fechado". */
function isOverdue(dataVencimento: string, status: TaskStatus): boolean {
  if (!dataVencimento) return false;
  if (TASK_STATUS_GROUP[status] === "fechado") return false;
  return dataVencimento < hojeISO();
}

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
  title,
}: {
  children?: ReactNode;
  onResizeStart?: (e: React.MouseEvent) => void;
  className?: string;
  /** Nome por extenso quando o rótulo da coluna é abreviado. */
  title?: string;
}) {
  return (
    <th title={title} className={`relative px-3 py-2 font-medium ${className}`}>
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

/**
 * Ação secundária da linha (renomear, remover): aparece no hover ou no foco
 * do teclado. Em tela de toque não existe hover, então fica sempre visível.
 */
const HOVER_ONLY =
  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
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
  // Ordem otimista do último arrasto, válida só enquanto o servidor ainda
  // devolve a ordem em que o arrasto foi feito (`baseKey`). Quando o refresh
  // traz a ordem nova, ela deixa de valer sozinha.
  //
  // Antes isso era `useState(tasks)` + `useEffect(() => setOrder(tasks),
  // [tasks])`. Quem chama passa um array NOVO a cada render (`tasks.filter()`,
  // `carregadas ?? []`), então o efeito disparava em todo render, o setState
  // gerava outro render, e a lista ficava em loop infinito de renderização —
  // um por cliente na Lista/Visão Geral, mesmo com o accordion fechado.
  const [optimistic, setOptimistic] = useState<{
    ids: string[];
    baseKey: string;
  } | null>(null);
  const serverKey = tasks.map((t) => t.id).join(",");
  // Derivado a cada render, sem estado nem efeito: os objetos vêm sempre de
  // `tasks`, então status/datas recém-salvos aparecem mesmo com a ordem
  // otimista ativa.
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const order =
    optimistic && optimistic.baseKey === serverKey
      ? optimistic.ids.flatMap((id) => byId.get(id) ?? [])
      : tasks;
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
        setOptimistic({ ids: next.map((x) => x.id), baseKey: serverKey });

        const fd = new FormData();
        fd.append("clientId", clientId);
        if (urlKey) fd.append("key", urlKey);
        next.forEach((x) => fd.append("taskId", x.id));
        // Se o servidor recusar (ex: "basico" tentando reordenar tarefa que
        // não é dele), reverte a ordem otimista em vez de deixar a UI mentir.
        reorderProjectTasksAction(fd)
          .then(() => router.refresh())
          .catch(() => setOptimistic(null));
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
  readOnly,
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
  /** Papel "basico" só vê (não edita) tarefa de outra pessoa — server já rejeita, isso só reflete na UI. */
  readOnly?: boolean;
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
  const [titulo, setTitulo] = useState(task.titulo);
  const [renomeando, setRenomeando] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  function salvarTitulo() {
    const novo = titulo.trim();
    setRenomeando(false);
    // Vazio ou igual: volta ao que estava, sem ir ao servidor.
    if (!novo || novo === task.titulo) {
      setTitulo(task.titulo);
      return;
    }
    setTitulo(novo);
    saveField("titulo", novo);
  }

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
    if (
      !window.confirm(
        `Remover "${task.titulo}"? Comentários e datas vão junto. Não dá pra desfazer.`
      )
    )
      return;
    const fd = baseFd();
    startTransition(async () => {
      await removeProjectTaskAction(fd);
      router.refresh();
    });
  }

  const totalCols = (clienteCell ? 1 : 0) + 7;
  const locked = pending || readOnly;

  return (
    <>
      <tr
        // Âncora estável da demanda: é o destino do campo `url` de
        // GET /api/demandas, que apps externos usam pra abrir a tarefa aqui.
        id={`tarefa-${task.id}`}
        draggable={false}
        onDragOver={drag?.onDragOver}
        onDrop={drag?.onDrop}
        className={`group border-t border-fysi-line hover:bg-fysi-cream/40 transition-colors scroll-mt-24 target:bg-fysi-yellow/40 ${
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
            {drag && !readOnly ? (
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
            {readOnly ? (
              <span
                className="text-fysi-muted/60 shrink-0"
                title="Somente leitura — tarefa de outra pessoa"
              >
                <LockIcon />
              </span>
            ) : null}
            {renomeando ? (
              <input
                type="text"
                value={titulo}
                autoFocus
                maxLength={200}
                onChange={(e) => setTitulo(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={salvarTitulo}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setTitulo(task.titulo);
                    setRenomeando(false);
                  }
                }}
                aria-label="Nome da tarefa"
                className="flex-1 min-w-0 rounded-[6px] border border-fysi-deep/40 bg-white text-sm text-fysi-deep px-1.5 py-0.5 focus:outline-none"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  onDoubleClick={() => {
                    if (!locked) setRenomeando(true);
                  }}
                  aria-expanded={expanded}
                  className="text-left hover:underline underline-offset-2 truncate min-w-0"
                  title={`${titulo} — clique pra ver observações e comentários`}
                >
                  {titulo}
                </button>
                {readOnly ? null : (
                  <button
                    type="button"
                    onClick={() => setRenomeando(true)}
                    disabled={locked}
                    aria-label={`Renomear "${titulo}"`}
                    title="Renomear"
                    className={`shrink-0 w-6 h-6 grid place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition ${HOVER_ONLY}`}
                  >
                    <PencilIcon />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <select
            value={status}
            disabled={locked}
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
            disabled={locked}
            onChange={(v) => {
              setPrioridade(v);
              saveField("prioridade", v);
            }}
          />
        </td>
        <td className="px-3 py-2 overflow-hidden">
          <AssigneePicker
            value={responsavel}
            disabled={locked}
            onChange={(v) => {
              setResponsavel(v);
              saveField("responsavel", v);
            }}
          />
        </td>
        {/* Datas com o mesmo seletor da barra de criação (atalhos Hoje /
            Amanhã / Próxima segunda). O <input type="date"> nativo não cabia
            na coluna — aparecia cortado como "dd/mm/aa". */}
        <td className="px-2 py-2 overflow-hidden">
          <DueDatePicker
            bare
            emptyLabel="Início"
            value={dataInicial}
            disabled={locked}
            onChange={(v) => {
              setDataInicial(v);
              saveField("dataInicial", v);
            }}
          />
        </td>
        <td className="px-2 py-2 overflow-hidden">
          <DueDatePicker
            bare
            emptyLabel="Vencimento"
            value={dataVencimento}
            disabled={locked}
            overdue={isOverdue(dataVencimento, status)}
            onChange={(v) => {
              setDataVencimento(v);
              saveField("dataVencimento", v);
            }}
          />
        </td>
        <td className="px-3 py-2 text-right overflow-hidden">
          {readOnly ? null : (
            <button
              type="button"
              onClick={remove}
              disabled={locked}
              aria-label={`Remover "${titulo}"`}
              title="Remover tarefa"
              className={`w-7 h-7 inline-grid place-items-center rounded-md text-fysi-muted hover:text-red-700 hover:bg-red-50 transition disabled:opacity-50 ${HOVER_ONLY}`}
            >
              <TrashIcon />
            </button>
          )}
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
                  {eiDocId ? "Ver Estrutura Inicial" : "Criar Estrutura Inicial"} →
                </Link>
              ) : null}

              <div>
                <label className="block text-xs uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1">
                  Observações da tarefa
                </label>
                <textarea
                  value={observacoes}
                  disabled={locked}
                  onChange={(e) => setObservacoes(e.target.value)}
                  onBlur={() => {
                    if (observacoes.trim() !== (task.observacoes ?? ""))
                      saveField("observacoes", observacoes);
                  }}
                  placeholder="Notas, links, contexto pra quem for mexer nessa tarefa…"
                  rows={3}
                  className="w-full rounded-[8px] border border-fysi-line bg-white text-sm px-3 py-2 focus:outline-none focus:border-fysi-deep/40 resize-y"
                />
                {extractUrls(observacoes).length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {extractUrls(observacoes).map((url, i) => (
                      <a
                        key={`${url}-${i}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-fysi-deep underline underline-offset-2 hover:text-fysi-green truncate max-w-xs"
                      >
                        <LinkIcon />
                        <span className="truncate">{url}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <TaskComments taskId={task.id} clientId={clientId} urlKey={urlKey} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function TaskComments({
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
    if (!window.confirm("Excluir este comentário?")) return;
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
      <label className="block text-xs uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1">
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
                  <span className="text-xs text-fysi-muted tabular-nums">
                    {formatCommentDate(c.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="text-xs text-red-700 opacity-0 group-hover/comment:opacity-100 hover:underline disabled:opacity-50"
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
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

// Textarea não renderiza link — extrai URLs do texto pra mostrar como
// chips clicáveis abaixo do campo (pedido do usuário: "link de site clicável").
const URL_REGEX = /https?:\/\/[^\s<>"']+/g;
function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

/**
 * undefined = sem restrição (admin/avancado/legacy). null = "basico" sem
 * vínculo de tarefas (nada editável). string = "basico" com vínculo — só
 * tarefas com esse `responsavel` são editáveis, o resto vira read-only.
 */
export type EditRestriction = string | null | undefined;

export function isReadOnlyFor(task: ProjectTask, restrict: EditRestriction): boolean {
  if (restrict === undefined) return false;
  if (restrict === null) return true;
  return task.responsavel !== restrict;
}

export function TasksBoard({
  clientId,
  urlKey,
  projectType,
  tasks,
  eiDocId,
  eiHref,
  restrictToResponsavel,
}: {
  clientId: string;
  urlKey?: string;
  projectType: ProjectType | null;
  tasks: ProjectTask[];
  eiDocId?: string | null;
  eiHref?: string;
  restrictToResponsavel?: EditRestriction;
}) {
  const router = useRouter();
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
    [270, 150, 78, 78, 92, 124, 40]
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

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6">
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
                <ResizableTh onResizeStart={startResize(2)} title="Prioridade">Prior.</ResizableTh>
                <ResizableTh onResizeStart={startResize(3)} title="Responsável">Resp.</ResizableTh>
                <ResizableTh onResizeStart={startResize(4)}>Início</ResizableTh>
                <ResizableTh onResizeStart={startResize(5)}>Vencimento</ResizableTh>
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
                  drag={
                    abertas.length > 1 && !isReadOnlyFor(t, restrictToResponsavel)
                      ? dragAbertas(t)
                      : undefined
                  }
                  eiDocId={eiDocId}
                  eiHref={eiHref}
                  readOnly={isReadOnlyFor(t, restrictToResponsavel)}
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
                        fechadas.length > 1 &&
                        !isReadOnlyFor(t, restrictToResponsavel)
                          ? dragFechadas(t)
                          : undefined
                      }
                      eiDocId={eiDocId}
                      eiHref={eiHref}
                      readOnly={isReadOnlyFor(t, restrictToResponsavel)}
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

      <div className="mt-4 pt-4 border-t border-fysi-line">
        {restrictToResponsavel === null ? (
          // "basico" sem vínculo de tarefas: o servidor recusaria a criação
          // (a tarefa nasceria sem poder ser editada por quem criou).
          <p className="text-xs text-fysi-muted">
            Pra adicionar tarefas, peça a um sócio pra ligar seu login a um
            responsável em Membros.
          </p>
        ) : (
          <TaskComposer
            clientId={clientId}
            urlKey={urlKey}
            defaultResponsavel={restrictToResponsavel ?? ""}
            lockResponsavel={typeof restrictToResponsavel === "string"}
          />
        )}
      </div>
    </section>
  );
}
