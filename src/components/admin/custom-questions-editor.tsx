"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addCustomQuestionAction,
  updateCustomQuestionAction,
  moveCustomQuestionAction,
  deleteCustomQuestionAction,
} from "@/app/admin/[id]/actions";
import {
  CUSTOM_TIPOS,
  type CustomQuestion,
  type CustomQuestionTipo,
} from "@/lib/custom-questions";

function tipoLabel(t: CustomQuestionTipo): string {
  return CUSTOM_TIPOS.find((x) => x.value === t)?.label ?? t;
}

interface FormValues {
  label: string;
  hint: string;
  tipo: CustomQuestionTipo;
  opcoes: string;
}

/** Form compartilhado por adicionar e editar. Mantém o próprio estado. */
function QuestionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
}: {
  initial?: { label: string; hint: string; tipo: CustomQuestionTipo; opcoes: string[] };
  submitLabel: string;
  onSubmit: (vals: FormValues) => void;
  onCancel?: () => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [tipo, setTipo] = useState<CustomQuestionTipo>(
    initial?.tipo ?? "texto-longo"
  );
  const [opcoes, setOpcoes] = useState((initial?.opcoes ?? []).join("\n"));

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Pergunta"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Ex: Qual o principal diferencial do seu produto?"
      />
      <Input
        label="Ajuda"
        optional
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="Dica curta pra orientar a resposta (opcional)"
      />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fysi-deep">
          Tipo de resposta
        </span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as CustomQuestionTipo)}
          className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
        >
          {CUSTOM_TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {tipo === "escolha" ? (
        <Textarea
          label="Opções"
          hint="Uma por linha."
          rows={3}
          value={opcoes}
          onChange={(e) => setOpcoes(e.target.value)}
          placeholder={"Opção A\nOpção B\nOpção C"}
        />
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onSubmit({ label, hint, tipo, opcoes })}
          disabled={pending || !label.trim()}
        >
          {pending ? "Salvando…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Admin: gerencia as perguntas específicas de um cliente (adicionar, editar,
 * reordenar, remover). Elas viram um bloco extra no briefing do cliente.
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function baseFd() {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    return fd;
  }

  function fillFields(fd: FormData, vals: FormValues) {
    fd.append("label", vals.label.trim());
    if (vals.hint.trim()) fd.append("hint", vals.hint.trim());
    fd.append("tipo", vals.tipo);
    fd.append("opcoes", vals.opcoes);
  }

  function add(vals: FormValues) {
    const fd = baseFd();
    fillFields(fd, vals);
    startTransition(async () => {
      await addCustomQuestionAction(fd);
      setAddKey((k) => k + 1);
    });
  }

  function update(id: string, vals: FormValues) {
    const fd = baseFd();
    fd.append("questionId", id);
    fillFields(fd, vals);
    startTransition(async () => {
      await updateCustomQuestionAction(fd);
      setEditingId(null);
    });
  }

  function move(id: string, direction: "up" | "down") {
    const fd = baseFd();
    fd.append("questionId", id);
    fd.append("direction", direction);
    startTransition(() => {
      moveCustomQuestionAction(fd);
    });
  }

  function remove(id: string) {
    const fd = baseFd();
    fd.append("questionId", id);
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
              className="bg-white border border-fysi-line rounded-[12px] p-3"
            >
              {editingId === q.id ? (
                <QuestionForm
                  initial={{
                    label: q.label,
                    hint: q.hint ?? "",
                    tipo: q.tipo,
                    opcoes: q.opcoes,
                  }}
                  submitLabel="Salvar"
                  onSubmit={(vals) => update(q.id, vals)}
                  onCancel={() => setEditingId(null)}
                  pending={pending}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fysi-deep">
                      {i + 1}. {q.label}
                    </p>
                    {q.hint ? (
                      <p className="text-xs text-fysi-muted mt-0.5">{q.hint}</p>
                    ) : null}
                    <p className="text-[0.7rem] text-fysi-muted mt-1">
                      {tipoLabel(q.tipo)}
                      {q.tipo === "escolha" && q.opcoes.length
                        ? ` · ${q.opcoes.join(" / ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => move(q.id, "up")}
                      disabled={pending || i === 0}
                      className="disabled:opacity-30 text-fysi-deep"
                      title="Subir"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(q.id, "down")}
                      disabled={pending || i === questions.length - 1}
                      className="disabled:opacity-30 text-fysi-deep"
                      title="Descer"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(q.id)}
                      disabled={pending}
                      className="text-fysi-deep underline underline-offset-2 disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(q.id)}
                      disabled={pending}
                      className="text-red-700 underline underline-offset-2 disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fysi-muted">
          Nenhuma pergunta específica ainda. Adicione abaixo — elas aparecem
          como um bloco extra no briefing deste cliente.
        </p>
      )}

      <div className="bg-fysi-cream/40 border border-fysi-line rounded-[12px] p-3">
        <p className="text-xs uppercase tracking-[0.12em] text-fysi-muted font-medium mb-2">
          Nova pergunta
        </p>
        <QuestionForm
          key={addKey}
          submitLabel="Adicionar pergunta"
          onSubmit={add}
          pending={pending}
        />
      </div>
    </div>
  );
}
