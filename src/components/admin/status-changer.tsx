"use client";

import { useState, useTransition } from "react";
import { setClientStatusAction } from "@/app/admin/[id]/actions";

/**
 * Altera o status de um cliente direto na listagem do admin (sem abrir).
 * Otimista: reflete a escolha na hora; a action revalida o /admin.
 */

const OPTIONS = [
  { value: "nao-iniciado", label: "Não iniciado" },
  { value: "em-andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "abandonado", label: "Abandonado" },
];

const TONE: Record<string, string> = {
  concluido: "bg-fysi-mint/40 text-fysi-deep border-fysi-mint/60",
  "em-andamento": "bg-white text-fysi-deep border-fysi-line",
  abandonado: "bg-red-50 text-red-700 border-red-200",
  "nao-iniciado": "bg-fysi-cream text-fysi-muted border-fysi-line",
};

export function StatusChanger({
  clientId,
  status,
  urlKey,
}: {
  clientId: string;
  status: string;
  urlKey?: string;
}) {
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === current) return;
    setCurrent(next);
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("status", next);
    if (urlKey) fd.append("key", urlKey);
    startTransition(() => {
      setClientStatusAction(fd);
    });
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      disabled={pending}
      aria-label="Alterar status"
      className={`rounded-full border text-xs font-medium px-3 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-fysi-deep/30 disabled:opacity-50 ${
        TONE[current] ?? TONE["nao-iniciado"]
      }`}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
