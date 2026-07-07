"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCustomQuestionAction,
  deleteCustomQuestionAction,
} from "@/app/admin/[id]/actions";
import type { CustomQuestion } from "@/lib/custom-questions";

/**
 * Admin: gerencia as perguntas específicas de um cliente. Elas aparecem como
 * um bloco extra no briefing daquele cliente.
 */
export function CustomQuestionsEditor({
  clientId,
  urlKey,
  questions,
}: {
  clientId: string;
  urlKey?: string;
  questions: CustomQuestion[];
}) {
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!label.trim()) return;
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("label", label.trim());
    if (hint.trim()) fd.append("hint", hint.trim());
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await addCustomQuestionAction(fd);
      setLabel("");
      setHint("");
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.append("questionId", id);
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(() => {
      deleteCustomQuestionAction(fd);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <li
              key={q.id}
              className="flex items-start justify-between gap-3 bg-white border border-fysi-line rounded-[12px] p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fysi-deep">
                  {i + 1}. {q.label}
                </p>
                {q.hint ? (
                  <p className="text-xs text-fysi-muted mt-0.5">{q.hint}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(q.id)}
                disabled={pending}
                className="text-xs text-red-700 hover:text-red-800 underline underline-offset-2 shrink-0 disabled:opacity-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fysi-muted">
          Nenhuma pergunta específica ainda. Adicione abaixo — elas aparecem
          como um bloco extra no briefing deste cliente.
        </p>
      )}

      <div className="flex flex-col gap-3 bg-fysi-cream/40 border border-fysi-line rounded-[12px] p-3">
        <Input
          label="Nova pergunta"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Qual o diferencial do seu produto?"
        />
        <Input
          label="Ajuda"
          optional
          hint="Uma dica curta pra orientar a resposta do cliente."
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Opcional"
        />
        <div>
          <Button
            type="button"
            size="sm"
            onClick={add}
            disabled={pending || !label.trim()}
          >
            {pending ? "Salvando…" : "Adicionar pergunta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
