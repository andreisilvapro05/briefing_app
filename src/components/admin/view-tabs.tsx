"use client";

import Link from "next/link";

/**
 * Barra de abas de visualização — as "Lista", "Lista Karine", "Lista
 * Andrei", "Lista Valéria" do ClickUp.
 *
 * Dois modos, porque as duas telas que usam isso filtram em lugares
 * diferentes: em Tarefas a lista inteira já está no navegador e a troca é
 * instantânea (`onSelect`); na Visão Geral a pizza vem montada do servidor,
 * então a aba é um link de verdade (`href` no item) e a página recarrega
 * com o recorte certo. Passar uma função de href não serviria: função não
 * atravessa a fronteira servidor→cliente.
 */

export interface ViewTabItem {
  value: string;
  label: string;
  /** Iniciais do avatar. Ausente na aba "Todos". */
  iniciais?: string;
  /** Classe de fundo do avatar (bg-violet-500 etc.). */
  cor?: string;
  count: number;
  /** Quando presente, a aba navega em vez de filtrar no cliente. */
  href?: string;
}

export function ViewTabs({
  items,
  ativo,
  onSelect,
  ariaLabel = "Lista por responsável",
}: {
  items: ViewTabItem[];
  ativo: string;
  onSelect?: (valor: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-end gap-1 overflow-x-auto border-b border-fysi-line"
    >
      {items.map((item) => {
        const selecionada = ativo === item.value;
        const classe = `flex items-center gap-2 shrink-0 whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition ${
          selecionada
            ? "border-fysi-deep text-fysi-deep font-semibold"
            : "border-transparent text-fysi-muted hover:text-fysi-deep hover:border-fysi-line-strong"
        }`;
        const dentro = (
          <>
            {item.iniciais ? (
              <span
                className={`w-5 h-5 rounded-full grid place-items-center text-[0.6rem] font-bold text-white shrink-0 ${item.cor ?? "bg-fysi-line-strong"}`}
              >
                {item.iniciais}
              </span>
            ) : null}
            {item.label}
            <span
              className={`tabular-nums text-xs ${
                selecionada ? "text-fysi-deep/60" : "text-fysi-muted"
              }`}
            >
              {item.count}
            </span>
          </>
        );

        if (item.href) {
          return (
            <Link
              key={item.value || "todos"}
              href={item.href}
              role="tab"
              aria-selected={selecionada}
              className={classe}
            >
              {dentro}
            </Link>
          );
        }
        return (
          <button
            key={item.value || "todos"}
            type="button"
            role="tab"
            aria-selected={selecionada}
            onClick={() => onSelect?.(item.value)}
            className={classe}
          >
            {dentro}
          </button>
        );
      })}
    </div>
  );
}
