"use client";

import { useState, useTransition } from "react";
import { renomearDocumentoAction } from "@/app/admin/notas/actions";

/**
 * Nome do documento, editável no lugar.
 *
 * O editor de blocos guarda o corpo, não o título — e um documento em
 * branco sem nome vira "Sem título" numa lista de "Sem título". Mesmo
 * gesto do resto do app: clicar no nome edita.
 */
export function NotaTitulo({
  docId,
  inicial,
  urlKey,
}: {
  docId: string;
  inicial: string;
  urlKey?: string | null;
}) {
  const [nome, setNome] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();

  function salvar() {
    const novo = nome.trim();
    setEditando(false);
    if (!novo || novo === inicial) {
      setNome(inicial);
      return;
    }
    const fd = new FormData();
    fd.append("docId", docId);
    fd.append("nome", novo);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await renomearDocumentoAction(fd);
    });
  }

  if (editando) {
    return (
      <input
        type="text"
        value={nome}
        autoFocus
        maxLength={200}
        onChange={(e) => setNome(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setNome(inicial);
            setEditando(false);
          }
        }}
        aria-label="Nome do documento"
        className="w-full rounded-[8px] border border-fysi-deep/40 bg-white px-2 py-1 text-[1.5rem] font-semibold text-fysi-deep focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      title="Clique pra renomear"
      className="text-left text-[1.5rem] font-semibold tracking-tight text-fysi-deep hover:underline underline-offset-4 decoration-fysi-line"
    >
      {nome}
      {pending ? (
        <span className="ml-2 text-xs font-normal text-fysi-muted">salvando…</span>
      ) : null}
    </button>
  );
}
