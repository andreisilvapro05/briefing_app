"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteClientAction } from "@/app/admin/[id]/actions";

/**
 * Botão de exclusão com confirmação inline.
 * Apaga o cliente + briefing_responses + briefing_files (cascade no banco).
 */
export function DeleteClientButton({
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
        className="text-xs text-red-700 hover:text-red-800 underline underline-offset-2"
      >
        Excluir cliente
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-red-50 border border-red-200 rounded-[12px] p-3">
      <p className="text-xs text-red-800 leading-relaxed">
        Tem certeza? Vai apagar <strong>{clientName}</strong> e TODAS as
        respostas + arquivos. Não dá pra desfazer.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <button
          type="button"
          onClick={handleConfirmedDelete}
          disabled={pending}
          className="rounded-full bg-red-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Apagando…" : "Sim, apagar"}
        </button>
      </div>
    </div>
  );
}
