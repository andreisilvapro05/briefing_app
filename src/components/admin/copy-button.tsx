"use client";

import { useState } from "react";

/**
 * Botão pra copiar um valor pra o clipboard com feedback visual.
 */
export function CopyButton({
  value,
  label = "Copiar",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-1.5 hover:bg-fysi-deep/90 whitespace-nowrap"
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
