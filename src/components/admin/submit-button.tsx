"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Detecta o fim de um submit: pending true→false. Serve pra mostrar um
 * "Salvo ✓" por ~1.8s depois que a Server Action termina (nas ações que
 * revalidam e ficam na página; as que dão redirect navegam antes e só não
 * mostram — sem problema).
 */
export function useJustFinished(pending: boolean): boolean {
  const [justFinished, setJustFinished] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    const prev = wasPending.current;
    wasPending.current = pending;
    if (prev && !pending) {
      setJustFinished(true);
      const t = setTimeout(() => setJustFinished(false), 1800);
      return () => clearTimeout(t);
    }
  }, [pending]);
  return justFinished;
}

/**
 * Botão de submit pra <form action={serverAction}> em Server Components.
 * useFormStatus desabilita + mostra "Salvando…" durante a ação e "Salvo ✓"
 * logo depois — mata o duplo-submit e dá o feedback de "cada clique" que os
 * forms de Server Component não tinham.
 *
 * Precisa ser filho do <form>. Opcional: `confirm` pra ações destrutivas.
 */
export function SubmitButton({
  children,
  pendingLabel,
  savedLabel = "Salvo ✓",
  confirm,
  ...rest
}: ButtonProps & {
  pendingLabel?: string;
  savedLabel?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const justSaved = useJustFinished(pending);
  return (
    <Button
      type="submit"
      disabled={pending || rest.disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...rest}
    >
      {pending
        ? (pendingLabel ?? "Salvando…")
        : justSaved
          ? savedLabel
          : children}
    </Button>
  );
}

/**
 * Variante "link/texto" pra ações destrutivas ou terciárias inline
 * (Remover / Desativar / excluir / salvar-discreto) que hoje são um
 * <button type=submit> cru sem confirmação nem pending.
 */
export function SubmitTextButton({
  children,
  pendingLabel,
  savedLabel = "✓",
  confirm,
  className = "",
  danger = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  savedLabel?: string;
  confirm?: string;
  className?: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  const justSaved = useJustFinished(pending);
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={
        className ||
        `text-xs font-medium hover:underline disabled:opacity-50 ${
          danger ? "text-red-700" : "text-fysi-deep"
        }`
      }
    >
      {pending ? (pendingLabel ?? "…") : justSaved ? savedLabel : children}
    </button>
  );
}
