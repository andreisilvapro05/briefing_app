"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_GROUP,
  TASK_PRIORITY_OPTIONS,
  TEAM_MEMBERS,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectTaskClient } from "@/lib/project-tasks-server";
import { updateProjectTaskAction } from "@/app/admin/[id]/actions";
import { useFocusTrap } from "./use-focus-trap";

type Task = ProjectTask & { client: ProjectTaskClient };

const STATUS_DOT: Record<string, string> = {
  parado: "#ef4444",
  "nem-comecou-nada": "#94a3b8",
  "a-iniciar": "#94a3b8",
  onboarding: "#6366f1",
  "envio-informacoes": "#06b6d4",
  "redacao-copy": "#ec4899",
  "design-pagina": "#8b5cf6",
  "validacao-design-copy": "#ef4444",
  "ajustes-design-copy": "#f59e0b",
  implementacao: "#f97316",
  "validacao-implementacao": "#ef4444",
  "ajuste-implementacao": "#f59e0b",
  "otimizacao-entrega": "#f97316",
  concluido: "#10b981",
  "completo-entregue": "#10b981",
};

const PRIORITY_FLAG_COLOR: Record<string, string> = {
  "": "text-fysi-line",
  urgente: "text-red-600",
  alta: "text-orange-500",
  normal: "text-blue-500",
  baixa: "text-fysi-muted",
};

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5 3a1 1 0 0 1 1-1h11.5a1 1 0 0 1 .8 1.6L15.25 8l3.05 4.4a1 1 0 0 1-.8 1.6H7a1 1 0 0 0-1 1V21a1 1 0 1 1-2 0V3z" />
    </svg>
  );
}

/** YYYY-MM-DD local — mesmo padrão de isOverdue() em tasks-board.tsx. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type Grupo = "hoje" | "atraso" | "proximo" | "sem-data";

function grupoDe(task: Task, hoje: string): Grupo {
  if (!task.data_vencimento) return "sem-data";
  if (task.data_vencimento === hoje) return "hoje";
  if (task.data_vencimento < hoje) return "atraso";
  return "proximo";
}

const GRUPO_LABEL: Record<Grupo, string> = {
  hoje: "Hoje",
  atraso: "Em atraso",
  proximo: "Próximo",
  "sem-data": "Não programado",
};

const GRUPO_ORDER: Grupo[] = ["hoje", "atraso", "proximo", "sem-data"];

function formatDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

function statusLabelOf(status: string): string {
  return TASK_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

/**
 * Bolinha de status clicável — abre um menu com todos os status (como no
 * ClickUp). A troca salva na hora via updateProjectTaskAction.
 */
function StatusDotPicker({
  task,
  onPick,
}: {
  task: Task;
  onPick: (status: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative shrink-0 inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={`Status: ${statusLabelOf(task.status)} — clique pra trocar`}
        aria-label={`Trocar status (atual: ${statusLabelOf(task.status)})`}
        aria-haspopup="true"
        aria-expanded={open}
        className="w-4 h-4 rounded-full border-2 grid place-items-center hover:scale-125 transition-transform"
        style={{ borderColor: STATUS_DOT[task.status] ?? "#94a3b8" }}
      />
      {open ? (
        <div
          className="absolute z-30 top-5 left-0 w-56 bg-white border border-fysi-line rounded-[12px] shadow-xl py-1 max-h-64 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {TASK_STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setOpen(false);
                if (o.value !== task.status) onPick(o.value);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left hover:bg-fysi-cream transition ${
                o.value === task.status
                  ? "font-semibold text-fysi-deep"
                  : "text-fysi-muted"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: STATUS_DOT[o.value] ?? "#94a3b8" }}
              />
              {o.label}
              {o.value === task.status ? (
                <span className="ml-auto text-fysi-deep">✓</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

function TaskRow({
  task,
  onOpen,
  onSave,
}: {
  task: Task;
  onOpen: () => void;
  onSave: (field: string, value: string) => void;
}) {
  const hoje = todayStr();
  const atrasada =
    !!task.data_vencimento &&
    task.data_vencimento < hoje &&
    TASK_STATUS_GROUP[task.status] === "ativo";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-fysi-cream/50 transition group cursor-pointer focus-visible:outline-2 focus-visible:outline-fysi-deep/40"
    >
      <StatusDotPicker task={task} onPick={(s) => onSave("status", s)} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-fysi-muted truncate">
          {task.client.empresa || task.client.nome}
        </span>
        <span className="block text-sm text-fysi-deep font-medium truncate group-hover:underline underline-offset-2">
          {task.titulo}
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {task.prioridade ? (
          <FlagIcon className={PRIORITY_FLAG_COLOR[task.prioridade] ?? PRIORITY_FLAG_COLOR[""]} />
        ) : null}
        {task.data_vencimento ? (
          <span
            className={`text-xs tabular-nums ${atrasada ? "text-red-600 font-medium" : "text-fysi-muted"}`}
          >
            {formatDate(task.data_vencimento)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Card da tarefa (estilo ClickUp) — abre ao clicar na linha. Status,
 * prioridade, responsável e datas editáveis na hora; observações e link
 * pro projeto completo.
 */
function TaskCardModal({
  task,
  keyParam,
  saving,
  onClose,
  onSave,
}: {
  task: Task;
  keyParam: string;
  saving: boolean;
  onClose: () => void;
  onSave: (field: string, value: string) => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selectClass =
    "w-full rounded-[10px] border border-fysi-line bg-white px-2.5 py-1.5 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-[8vh] px-4"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={task.titulo}
        className="bg-white rounded-[20px] shadow-2xl w-full max-w-xl max-h-[82vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-fysi-line">
          <div className="min-w-0">
            <p className="text-xs text-fysi-muted mb-1 truncate">
              {task.client.empresa || task.client.nome}
            </p>
            <h2 className="text-lg font-semibold text-fysi-deep leading-snug">
              {task.titulo}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving ? (
              <span className="text-xs text-fysi-muted">Salvando…</span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-full text-fysi-muted hover:bg-fysi-cream hover:text-fysi-deep transition"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
                Status
              </span>
              <span className="relative inline-flex items-center">
                <span
                  className="absolute left-2.5 w-2.5 h-2.5 rounded-full pointer-events-none"
                  style={{ background: STATUS_DOT[task.status] ?? "#94a3b8" }}
                />
                <select
                  value={task.status}
                  onChange={(e) => onSave("status", e.target.value)}
                  className={`${selectClass} pl-7`}
                >
                  {TASK_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
                Prioridade
              </span>
              <select
                value={task.prioridade ?? ""}
                onChange={(e) => onSave("prioridade", e.target.value)}
                className={selectClass}
              >
                {TASK_PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
                Responsável
              </span>
              <select
                value={task.responsavel ?? ""}
                onChange={(e) => onSave("responsavel", e.target.value)}
                className={selectClass}
              >
                <option value="">Sem responsável</option>
                {TEAM_MEMBERS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
                  Início
                </span>
                <input
                  type="date"
                  defaultValue={task.data_inicial ?? ""}
                  onBlur={(e) => onSave("dataInicial", e.target.value)}
                  className={selectClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
                  Vencimento
                </span>
                <input
                  type="date"
                  defaultValue={task.data_vencimento ?? ""}
                  onBlur={(e) => onSave("dataVencimento", e.target.value)}
                  className={selectClass}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold mb-1.5">
              Observações
            </p>
            {task.observacoes ? (
              <p className="text-sm text-fysi-deep leading-relaxed whitespace-pre-wrap">
                {task.observacoes}
              </p>
            ) : (
              <p className="text-sm text-fysi-muted italic">Sem observações.</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-fysi-line bg-fysi-cream/30">
          <Link
            href={`/admin/${task.client_id}?tab=tarefas${keyParam ? `&${keyParam.slice(1)}` : ""}`}
            className="text-sm font-medium text-fysi-deep hover:underline"
          >
            Abrir no projeto (subtarefas, comentários) →
          </Link>
        </div>
      </div>
    </div>
  );
}

function GroupSection({
  grupo,
  tasks,
  defaultOpen,
  onOpenTask,
  onSave,
}: {
  grupo: Grupo;
  tasks: Task[];
  defaultOpen: boolean;
  onOpenTask: (id: string) => void;
  onSave: (task: Task, field: string, value: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (tasks.length === 0) return null;

  return (
    <div className="border-t border-fysi-line first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-fysi-cream/40 transition"
      >
        <span className={`text-fysi-muted transition-transform ${open ? "rotate-90" : ""}`}>
          ▸
        </span>
        <span className="text-sm font-semibold text-fysi-deep">{GRUPO_LABEL[grupo]}</span>
        <span className="text-xs text-fysi-muted">{tasks.length}</span>
      </button>
      {open ? (
        <div className="pb-1">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={() => onOpenTask(t.id)}
              onSave={(field, value) => onSave(t, field, value)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type TabId = "pendente" | "feito" | "delegado";

export function MyWorkBoard({
  tasks,
  keyParam,
  urlKey,
}: {
  tasks: Task[];
  keyParam: string;
  urlKey: string | null;
}) {
  const [tab, setTab] = useState<TabId>("pendente");
  const [patches, setPatches] = useState<Record<string, Partial<Task>>>({});
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const hoje = todayStr();

  const merged = useMemo(
    () => tasks.map((t) => ({ ...t, ...patches[t.id] })),
    [tasks, patches]
  );

  const openTask = useMemo(
    () => merged.find((t) => t.id === openTaskId) ?? null,
    [merged, openTaskId]
  );

  function saveField(task: Task, field: string, value: string) {
    const FIELD_TO_COLUMN: Record<string, keyof Task> = {
      status: "status",
      prioridade: "prioridade",
      responsavel: "responsavel",
      dataInicial: "data_inicial",
      dataVencimento: "data_vencimento",
    };
    const column = FIELD_TO_COLUMN[field];
    if (!column) return;
    const previous = task[column];
    // Otimista: aplica já; reverte se o servidor falhar.
    setPatches((p) => ({
      ...p,
      [task.id]: { ...p[task.id], [column]: value || null },
    }));
    const fd = new FormData();
    fd.append("taskId", task.id);
    fd.append("clientId", task.client_id);
    fd.append(field, value);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      try {
        await updateProjectTaskAction(fd);
      } catch {
        setPatches((p) => ({
          ...p,
          [task.id]: { ...p[task.id], [column]: previous },
        }));
      }
    });
  }

  const pendentes = useMemo(
    () => merged.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo"),
    [merged]
  );
  const feitos = useMemo(
    () => merged.filter((t) => TASK_STATUS_GROUP[t.status] === "fechado"),
    [merged]
  );

  const grupos = useMemo(() => {
    const map: Record<Grupo, Task[]> = {
      hoje: [],
      atraso: [],
      proximo: [],
      "sem-data": [],
    };
    for (const t of pendentes) map[grupoDe(t, hoje)].push(t);
    return map;
  }, [pendentes, hoje]);

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card overflow-hidden">
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-sm font-semibold text-fysi-deep">Meu trabalho</p>
          {saving ? (
            <span className="text-xs text-fysi-muted">Salvando…</span>
          ) : null}
        </div>
        <div className="flex gap-1 border-b border-fysi-line -mb-px">
          {(
            [
              { id: "pendente", label: "Pendente" },
              { id: "feito", label: "Feito" },
              { id: "delegado", label: "Delegado" },
            ] as { id: TabId; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                tab === t.id
                  ? "border-fysi-deep text-fysi-deep"
                  : "border-transparent text-fysi-muted hover:text-fysi-deep"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pendente" ? (
        pendentes.length === 0 ? (
          <p className="text-sm text-fysi-muted text-center py-10">
            Nenhuma tarefa pendente 🎉
          </p>
        ) : (
          <div>
            {GRUPO_ORDER.map((g) => (
              <GroupSection
                key={g}
                grupo={g}
                tasks={grupos[g]}
                defaultOpen={g === "hoje" || g === "atraso"}
                onOpenTask={setOpenTaskId}
                onSave={saveField}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === "feito" ? (
        feitos.length === 0 ? (
          <p className="text-sm text-fysi-muted text-center py-10">
            Nenhuma tarefa concluída ainda.
          </p>
        ) : (
          <div className="pb-1">
            {feitos.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onOpen={() => setOpenTaskId(t.id)}
                onSave={(field, value) => saveField(t, field, value)}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === "delegado" ? (
        <p className="text-sm text-fysi-muted text-center py-10 px-6">
          Delegação de tarefas ainda não é rastreada neste painel — dá pra
          ver quem é responsável por cada tarefa em{" "}
          <Link href={`/admin/tarefas${keyParam}`} className="text-fysi-deep underline">
            Tarefas
          </Link>
          .
        </p>
      ) : null}

      {openTask ? (
        <TaskCardModal
          task={openTask}
          keyParam={keyParam}
          saving={saving}
          onClose={() => setOpenTaskId(null)}
          onSave={(field, value) => saveField(openTask, field, value)}
        />
      ) : null}
    </section>
  );
}
