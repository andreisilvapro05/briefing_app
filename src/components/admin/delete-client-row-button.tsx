"use client";

import { useState, useTransition } from "react";
import { deleteClientAction } from "@/app/admin/[id]/actions";

/**
 * Versão compacta do delete pra linhas da tabela do /admin.
 * Estado de confirmação em popover inline, sem alargar a linha.
 */
export function DeleteClientRowButton({
  clientId,
  clientName,
  urlKey,
}: {
  clientId: string;
  clientName: string;
  urlKey?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirmedDelete() {
    const formData = new FormData();
    formData.append("clientId", clientId);
    if (urlKey) formData.append("key", urlKey);
    startTransition(() => {
      deleteClientAction(formData);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={`Excluir ${clientName}`}
        aria-label={`Excluir ${clientName}`}
        className="inline-flex items-center justify-center h-7 w-7 rounded-full text-fysi-muted hover:text-red-700 hover:bg-red-50 transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-2 py-1">
      <span className="text-[0.7rem] text-red-800">Apagar?</span>
      <button
        type="button"
        onClick={handleConfirmedDelete}
        disabled={pending}
        className="rounded-full bg-red-600 text-white text-[0.7rem] font-medium px-2 py-0.5 hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "…" : "Sim"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-[0.7rem] text-fysi-muted hover:text-fysi-deep"
      >
        Não
      </button>
    </div>
  );
}
