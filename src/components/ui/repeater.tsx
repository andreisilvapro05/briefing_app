"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface RepeaterProps<T> {
  value: T[];
  onChange: (items: T[]) => void;
  // Cria um item vazio (default values).
  newItem: () => T;
  // Renderiza cada item (recebe o item, índice e função para atualizá-lo).
  renderItem: (item: T, idx: number, update: (next: T) => void) => ReactNode;
  addLabel?: string;
  emptyLabel?: string;
  min?: number;
  max?: number;
  className?: string;
}

/**
 * Permite adicionar/remover múltiplos blocos de campos similares.
 * Usado em referências, concorrentes, FAQs, depoimentos, mídia etc.
 */
export function Repeater<T>({
  value,
  onChange,
  newItem,
  renderItem,
  addLabel = "+ Adicionar",
  emptyLabel = "Nenhum item adicionado ainda.",
  min = 0,
  max = 50,
  className,
}: RepeaterProps<T>) {
  function add() {
    if (value.length >= max) return;
    onChange([...value, newItem()]);
  }

  function update(idx: number, next: T) {
    const copy = [...value];
    copy[idx] = next;
    onChange(copy);
  }

  function remove(idx: number) {
    if (value.length <= min) return;
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {value.length === 0 ? (
        <p className="text-xs text-fysi-muted italic">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {value.map((item, idx) => (
            <li
              key={idx}
              className="rounded-[14px] border border-fysi-line bg-white p-4 relative"
            >
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[0.7rem] uppercase tracking-[0.12em] font-medium text-fysi-muted">
                  Item {idx + 1}
                </span>
                {value.length > min ? (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="text-xs text-fysi-muted hover:text-red-600"
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              {renderItem(item, idx, (next) => update(idx, next))}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={add}
        disabled={value.length >= max}
        className={cn(
          "self-start inline-flex items-center gap-2 rounded-full border border-dashed border-fysi-deep/25 px-4 py-2 text-sm font-medium text-fysi-deep transition",
          "hover:border-fysi-deep/50 hover:bg-fysi-cream",
          value.length >= max && "opacity-50 cursor-not-allowed"
        )}
      >
        {addLabel}
      </button>
    </div>
  );
}
