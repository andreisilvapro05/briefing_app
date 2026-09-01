"use client";

import type { ReactNode } from "react";

/**
 * <select> que auto-submete o <form> em volta ao mudar. PRECISA ser um
 * Client Component: um onChange inline num Server Component não é uma
 * Server Action, então o React não consegue serializar essa função pro
 * cliente — isso derrubava a página inteira (RSC render error) sempre que
 * havia pelo menos uma linha pra renderizar o select. Causa raiz real do
 * crash de /admin/membros (não era o signInWithOtp).
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
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      title={title}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {children}
    </select>
  );
}
