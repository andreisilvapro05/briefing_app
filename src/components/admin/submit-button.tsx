"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Botão de submit pra <form action={serverAction}> em Server Components.
 * Usa useFormStatus pra desabilitar + mostrar "…" enquanto a ação roda —
 * mata o duplo-submit e dá feedback de "algo está acontecendo" que os
 * forms de Server Component não tinham (pedido: "cada clique, cada envio").
 *
 * Precisa ser filho do <form> (regra do useFormStatus). Opcional: `confirm`
 * pra ações destrutivas (delete) mostrarem um window.confirm antes.
 */
export function SubmitButton({
  children,
  pendingLabel,
  confirm,
  ...rest
}: ButtonProps & { pendingLabel?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || rest.disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...rest}
    >
      {pending ? (pendingLabel ?? "Salvando…") : children}
    </Button>
  );
}

/**
 * Variante "link/texto" pra ações destrutivas inline (Remover / Desativar /
 * excluir) que hoje são um <button type=submit> cru sem confirmação nem
 * pending. Mesmo useFormStatus, aparência de link discreto.
 */
export function SubmitTextButton({
  children,
  pendingLabel,
  confirm,
  className = "",
  danger = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  confirm?: string;
  className?: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
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
      {pending ? (pendingLabel ?? "…") : children}
    </button>
  );
}
