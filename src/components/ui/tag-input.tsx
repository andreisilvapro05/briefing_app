"use client";

import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface TagInputProps {
  label?: string;
  hint?: string;
  placeholder?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}

/**
 * Input para tags — usado no Bloco 5 (palavras-chave de SEO).
 * Adiciona tag com Enter ou vírgula.
 */
export function TagInput({
  label,
  hint,
  placeholder = "Digite e pressione Enter",
  value,
  onChange,
  max = 30,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commit(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (value.length >= max) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value.length - 1);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label className="text-sm font-medium text-fysi-deep">{label}</label>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 min-h-12 rounded-[12px] border border-fysi-line bg-white px-3 py-2 transition",
          "focus-within:border-fysi-green/40 focus-within:shadow-[0_0_0_4px_rgba(141,226,197,0.25)]"
        )}
      >
        {value.map((tag, idx) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full bg-fysi-mint px-3 py-1 text-xs font-medium text-fysi-deep"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-fysi-deep/60 hover:text-fysi-deep"
              aria-label={`Remover ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-fysi-deep outline-none border-0 focus:ring-0"
        />
      </div>

      {hint ? <p className="text-xs text-fysi-muted">{hint}</p> : null}
    </div>
  );
}
