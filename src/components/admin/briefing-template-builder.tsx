"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveBriefingTemplateAction,
  applyTemplateToClientAction,
} from "@/app/admin/briefings/actions";
import {
  CUSTOM_TIPOS,
  type CustomQuestionTipo,
} from "@/lib/custom-questions";
import type { TemplateQuestion } from "@/lib/briefing-templates";

function tipoLabel(t: CustomQuestionTipo): string {
  return CUSTOM_TIPOS.find((x) => x.value === t)?.label ?? t;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `q-${Math.random().toString(36).slice(2)}`;
}

interface FormValues {
  label: string;
  hint: string;
  tipo: CustomQuestionTipo;
  opcoes: string;
}

/** Form compartilhado por adicionar e editar uma pergunta do template. */
function QuestionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: {
    label: string;
    hint: string;
    tipo: CustomQuestionTipo;
    opcoes: string[];
  };
  submitLabel: string;
  onSubmit: (vals: FormValues) => void;
  onCancel?: () => void;
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
          disabled={!label.trim()}
        >
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface ClientOption {
  id: string;
  nome: string;
  empresa: string | null;
}

/**
 * Builder de um template de briefing. Mantém nome + lista de perguntas no
 * estado do client e salva o array inteiro de uma vez. Também aplica o
 * template a um cliente (copia as perguntas pro briefing dele).
 */
export function BriefingTemplateBuilder({
  templateId,
  urlKey,
  initialNome,
  initialPerguntas,
  clients,
}: {
  templateId: string;
  urlKey?: string;
  initialNome: string;
  initialPerguntas: TemplateQuestion[];
  clients: ClientOption[];
}) {
  const [nome, setNome] = useState(initialNome);
  const [perguntas, setPerguntas] =
    useState<TemplateQuestion[]>(initialPerguntas);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [applyClientId, setApplyClientId] = useState("");
  const [applyPending, startApply] = useTransition();

  function toQuestion(vals: FormValues, id: string, ordem: number): TemplateQuestion {
    const opcoes =
      vals.tipo === "escolha"
        ? vals.opcoes
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean)
        : [];
    return {
      id,
      label: vals.label.trim(),
      hint: vals.hint.trim() || null,
      tipo: vals.tipo,
      opcoes,
      ordem,
    };
  }

  function add(vals: FormValues) {
    setPerguntas((prev) => [
      ...prev,
      toQuestion(vals, newId(), prev.length),
    ]);
    setAddKey((k) => k + 1);
    setSaved(false);
  }

  function update(id: string, vals: FormValues) {
    setPerguntas((prev) =>
      prev.map((q, i) => (q.id === id ? toQuestion(vals, id, i) : q))
    );
    setEditingId(null);
    setSaved(false);
  }

  function move(id: string, direction: "up" | "down") {
    setPerguntas((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((q, i) => ({ ...q, ordem: i }));
    });
    setSaved(false);
  }

  function remove(id: string) {
    setPerguntas((prev) =>
      prev.filter((q) => q.id !== id).map((q, i) => ({ ...q, ordem: i }))
    );
    setSaved(false);
  }

  function save() {
    const fd = new FormData();
    fd.append("id", templateId);
    if (urlKey) fd.append("key", urlKey);
    fd.append("nome", nome.trim());
    fd.append("perguntas", JSON.stringify(perguntas));
    startTransition(async () => {
      await saveBriefingTemplateAction(fd);
      setSaved(true);
    });
  }

  function apply() {
    if (!applyClientId) return;
    const fd = new FormData();
    fd.append("templateId", templateId);
    fd.append("clientId", applyClientId);
    if (urlKey) fd.append("key", urlKey);
    startApply(() => {
      applyTemplateToClientAction(fd);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Nome + salvar */}
      <div className="bg-white border border-fysi-line rounded-[16px] p-4 flex flex-col gap-3">
        <Input
          label="Nome do briefing"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setSaved(false);
          }}
          placeholder="Ex: Briefing — Landing Page"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={pending || !nome.trim()}
          >
            {pending ? "Salvando…" : "Salvar briefing"}
          </Button>
          {saved && !pending ? (
            <span className="text-sm text-fysi-green font-medium">
              Salvo ✓
            </span>
          ) : (
            <span className="text-xs text-fysi-muted">
              {perguntas.length} pergunta{perguntas.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Perguntas */}
      <div className="flex flex-col gap-4">
        {perguntas.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {perguntas.map((q, i) => (
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
                    submitLabel="Salvar pergunta"
                    onSubmit={(vals) => update(q.id, vals)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fysi-deep">
                        {i + 1}. {q.label}
                      </p>
                      {q.hint ? (
                        <p className="text-xs text-fysi-muted mt-0.5">
                          {q.hint}
                        </p>
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
                        disabled={i === 0}
                        className="disabled:opacity-30 text-fysi-deep"
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(q.id, "down")}
                        disabled={i === perguntas.length - 1}
                        className="disabled:opacity-30 text-fysi-deep"
                        title="Descer"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(q.id)}
                        className="text-fysi-deep underline underline-offset-2"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(q.id)}
                        className="text-red-700 underline underline-offset-2"
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
            Nenhuma pergunta ainda. Adicione abaixo — depois é só salvar e
            aplicar a um cliente.
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
          />
        </div>
      </div>

      {/* Aplicar a um cliente */}
      <div className="bg-white border border-fysi-line rounded-[16px] p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-fysi-deep">
            Aplicar a um cliente
          </p>
          <p className="text-xs text-fysi-muted mt-0.5">
            Copia estas perguntas pro briefing do cliente escolhido. Salve as
            alterações antes de aplicar.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={applyClientId}
            onChange={(e) => setApplyClientId(e.target.value)}
            className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep flex-1 min-w-0"
          >
            <option value="">Escolha um cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.empresa ? `${c.empresa} — ${c.nome}` : c.nome}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={apply}
            disabled={applyPending || !applyClientId || perguntas.length === 0}
          >
            {applyPending ? "Aplicando…" : "Aplicar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
