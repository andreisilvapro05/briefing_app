"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClientStatusAction } from "@/app/admin/[id]/actions";
import {
  DEFAULT_TASK_STATUS,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  type TaskStatus,
} from "@/lib/project-tasks";

/**
 * Altera o status do projeto principal direto na listagem do admin (sem
 * abrir). Mesma taxonomia de 14 valores usada pelas tarefas internas
 * (project_tasks) — os status reais do ClickUp da equipe. Otimista: reflete
 * a escolha na hora; a action revalida o /admin.
 */

export function StatusChanger({
  clientId,
  status,
  urlKey,
}: {
  clientId: string;
  status: string;
  urlKey?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === current) return;
    setCurrent(next);
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("status", next);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await setClientStatusAction(fd);
      // Re-renderiza a página atual (força-dinâmica) pra o item reagrupar
      // na hora — ex: na Lista por status, muda de grupo ao trocar o status.
      router.refresh();
    });
  }

  return (
    <span className="relative inline-flex">
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        aria-label="Alterar status"
        className={`appearance-none rounded-full border text-xs font-medium pl-3 pr-6 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-fysi-deep/30 disabled:opacity-50 ${
          TASK_STATUS_TONE[current as TaskStatus] ?? TASK_STATUS_TONE[DEFAULT_TASK_STATUS]
        }`}
      >
        {TASK_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
