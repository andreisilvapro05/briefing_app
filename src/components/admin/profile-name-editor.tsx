"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnNameAction } from "@/app/admin/actions";

/**
 * Nome editável no Meu Perfil — lápis abre o input, Enter/Salvar grava.
 * Só pra quem tem identidade própria (canEdit); sessão compartilhada vê
 * o texto puro.
 */
export function ProfileNameEditor({
  initialName,
  urlKey,
  canEdit,
}: {
  initialName: string;
  urlKey: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return <span className="text-sm text-fysi-deep font-medium">{name}</span>;
  }

  function save() {
    const value = draft.trim();
    if (value === name) {
      setEditing(false);
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append("name", value);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      const res = await updateOwnNameAction(fd);
      if (!res.ok) {
        setError(
          res.error === "invalid-name"
            ? "Nome precisa ter entre 2 e 80 letras."
            : "Não consegui salvar. Tenta de novo."
        );
        return;
      }
      setName(res.name);
      setDraft(res.name);
      setEditing(false);
      // Atualiza o nome no topbar e onde mais aparecer.
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-sm text-fysi-deep font-medium">{name}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
        >
          ✎ editar
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          maxLength={80}
          className="rounded-[8px] border border-fysi-line bg-white px-2 py-1 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || draft.trim().length < 2}
          className="rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-1 hover:bg-fysi-deep/90 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-fysi-muted hover:text-fysi-deep"
        >
          cancelar
        </button>
      </span>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
