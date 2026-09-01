"use client";

/**
 * Botão de excluir genérico — submete o <form> pai (server action), com
 * confirm() pra evitar clique acidental. Pra listas pequenas (metas,
 * itens de planejamento) onde um botão de client-side dedicado por
 * contexto seria overkill.
 */
export function DeleteButton({ label = "✕" }: { label?: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm("Excluir?")) e.preventDefault();
      }}
      className="shrink-0 w-6 h-6 grid place-items-center rounded-full text-fysi-muted hover:bg-red-50 hover:text-red-600 transition"
      aria-label="Excluir"
      title="Excluir"
    >
      {label}
    </button>
  );
}
