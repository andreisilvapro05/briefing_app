"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_GROUP,
  type ProjectTask,
} from "@/lib/project-tasks";
import type { ProjectTaskClient } from "@/lib/project-tasks-server";

type Task = ProjectTask & { client: ProjectTaskClient };

const STATUS_DOT: Record<string, string> = {
  parado: "#ef4444",
  "nem-comecou-nada": "#94a3b8",
  "a-iniciar": "#94a3b8",
  onboarding: "#6366f1",
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
    });
  } catch {
    return iso;
  }
}

function TaskRow({ task, keyParam }: { task: Task; keyParam: string }) {
  const hoje = todayStr();
  const atrasada =
    !!task.data_vencimento &&
    task.data_vencimento < hoje &&
    TASK_STATUS_GROUP[task.status] === "ativo";
  const statusLabel =
    TASK_STATUS_OPTIONS.find((o) => o.value === task.status)?.label ?? task.status;

  return (
    <Link
      href={`/admin/${task.client_id}?tab=tarefas${keyParam ? `&${keyParam.slice(1)}` : ""}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-fysi-cream/50 transition group"
    >
      <span
        className="w-3 h-3 rounded-full border-2 shrink-0"
        style={{ borderColor: STATUS_DOT[task.status] ?? "#94a3b8" }}
        title={statusLabel}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] text-fysi-muted truncate">
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
    </Link>
  );
}

function GroupSection({
  grupo,
  tasks,
  keyParam,
  defaultOpen,
}: {
  grupo: Grupo;
  tasks: Task[];
  keyParam: string;
  defaultOpen: boolean;
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
            <TaskRow key={t.id} task={t} keyParam={keyParam} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type TabId = "pendente" | "feito" | "delegado";

export function MyWorkBoard({ tasks, keyParam }: { tasks: Task[]; keyParam: string }) {
  const [tab, setTab] = useState<TabId>("pendente");
  const hoje = todayStr();

  const pendentes = useMemo(
    () => tasks.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo"),
    [tasks]
  );
  const feitos = useMemo(
    () => tasks.filter((t) => TASK_STATUS_GROUP[t.status] === "fechado"),
    [tasks]
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
    <section className="bg-white border border-fysi-line rounded-[20px] overflow-hidden">
      <div className="px-5 pt-4">
        <p className="text-sm font-semibold text-fysi-deep mb-3">Meu trabalho</p>
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
                keyParam={keyParam}
                defaultOpen={g === "hoje" || g === "atraso"}
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
              <TaskRow key={t.id} task={t} keyParam={keyParam} />
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
    </section>
  );
}

