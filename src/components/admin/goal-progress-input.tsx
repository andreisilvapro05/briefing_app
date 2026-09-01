"use client";

import { useState, useTransition } from "react";
import { updateGoalAtualAction } from "@/app/admin/marketing/actions";

/**
 * Valor "atual" de uma meta — editável inline (salva ao sair do campo),
 * mesmo padrão de auto-save por blur já usado em tasks-board.tsx.
 */
export function GoalProgressInput({
  goalId,
  atual,
  unidade,
  urlKey,
}: {
  goalId: string;
  atual: number;
  unidade: string | null;
  urlKey?: string | null;
}) {
  const [value, setValue] = useState(String(atual));
  const [, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.append("id", goalId);
    fd.append("atual", value);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await updateGoalAtualAction(fd);
    });
  }

  return (
    <label className="flex items-baseline gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        className="w-16 rounded-[8px] border border-fysi-line bg-white px-2 py-1 text-lg font-semibold text-fysi-deep text-right focus:outline-none focus:border-fysi-deep/40"
      />
      {unidade ? <span className="text-xs text-fysi-muted">{unidade}</span> : null}
    </label>
  );
}
