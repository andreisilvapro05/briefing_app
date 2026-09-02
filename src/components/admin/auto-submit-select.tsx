"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useJustFinished } from "./submit-button";

/**
 * <select> que auto-submete o <form> em volta ao mudar. PRECISA ser um
 * Client Component: um onChange inline num Server Component não é uma
 * Server Action, então o React não consegue serializar essa função pro
 * cliente — isso derrubava a página inteira (RSC render error) sempre que
 * havia pelo menos uma linha pra renderizar o select. Causa raiz real do
 * crash de /admin/membros (não era o signInWithOtp).
 *
 * Mostra estado de salvamento (desabilita enquanto envia + "Salvo ✓"
 * depois) — antes a pessoa trocava o papel de um membro e nada na tela
 * indicava que tinha gravado.
 */
export function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  title,
  children,
}: {
  name: string;
  defaultValue: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  const justSaved = useJustFinished(pending);

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        name={name}
        defaultValue={defaultValue}
        title={title}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`${className ?? ""} disabled:opacity-60`}
      >
        {children}
      </select>
      {pending ? (
        <span className="text-[0.68rem] text-fysi-muted whitespace-nowrap">
          salvando…
        </span>
      ) : justSaved ? (
        <span className="text-[0.68rem] text-fysi-deep font-medium whitespace-nowrap">
          Salvo ✓
        </span>
      ) : null}
    </span>
  );
}
