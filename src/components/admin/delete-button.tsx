"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de excluir genérico — submete o <form> pai (server action), com
 * confirm() pra evitar clique acidental. Pra listas pequenas (metas,
 * itens de planejamento) onde um botão dedicado por contexto seria overkill.
 *
 * `what` descreve o que será excluído — sem isso o confirm dizia só
 * "Excluir?", sem a pessoa saber o quê. Desabilita durante o envio pra não
 * dar pra clicar duas vezes.
 */
export function DeleteButton({
  label = "✕",
  what,
}: {
  label?: string;
  /** Ex.: 'a meta "Faturamento"'. Vira: Excluir a meta "Faturamento"? */
  what?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(`Excluir ${what ?? "este item"}? Não dá pra desfazer.`)) {
          e.preventDefault();
        }
      }}
      className="shrink-0 w-6 h-6 grid place-items-center rounded-full text-fysi-muted hover:bg-red-50 hover:text-red-600 transition disabled:opacity-40"
      aria-label="Excluir"
      title="Excluir"
    >
      {pending ? "…" : label}
    </button>
  );
}
