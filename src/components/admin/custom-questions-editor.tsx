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
import {
  contar,
  fraseDasPerguntas,
  montarPerguntas,
} from "@/lib/perguntas-pendentes";

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
  respostas,
}: {
  clientId: string;
  urlKey?: string;
  questions: CustomQuestion[];
  /**
   * `field_id -> value` das respostas do briefing. Sem isso a tela não tem
   * como saber o que está PENDENTE — e "questões pendentes" é justamente
   * o que a Karine pediu pra ver.
   */
  respostas?: Map<string, unknown>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detalhesDe, setDetalhesDe] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lista = montarPerguntas(questions, respostas ?? new Map());
  const contagem = contar(lista);

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

  /**
   * Toda escrita passa por aqui pra que a falha APAREÇA.
   *
   * As quatro actions devolvem `void` e só logam o erro no servidor; a
   * tela antiga limpava o formulário logo depois do `await`, então uma
   * pergunta que não salvou sumia do campo como se tivesse entrado. Pelo
   * menos a queda de rede agora é dita.
   */
  function escrever(acao: () => Promise<void>, depois?: () => void) {
    setErro(null);
    startTransition(async () => {
      try {
        await acao();
      } catch {
        setErro("Não consegui salvar. Confira a conexão e tente de novo.");
        return;
      }
      depois?.();
    });
  }

  function add(vals: FormValues) {
    const fd = baseFd();
    fillFields(fd, vals);
    escrever(() => addCustomQuestionAction(fd), () => {
      setAddKey((k) => k + 1);
      setAdicionando(false);
    });
  }

  function update(id: string, vals: FormValues) {
    const fd = baseFd();
    fd.append("questionId", id);
    fillFields(fd, vals);
    escrever(() => updateCustomQuestionAction(fd), () => setEditingId(null));
  }

  function move(id: string, direction: "up" | "down") {
    const fd = baseFd();
    fd.append("questionId", id);
    fd.append("direction", direction);
    escrever(() => moveCustomQuestionAction(fd));
  }

  function remove(id: string, label: string) {
    if (!window.confirm(`Remover "${label}"? A resposta do cliente vai junto.`))
      return;
    const fd = baseFd();
    fd.append("questionId", id);
    escrever(() => deleteCustomQuestionAction(fd), () => setDetalhesDe(null));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Uma linha com o placar, como no checklist de materiais. */}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium text-fysi-deep">
          {fraseDasPerguntas(contagem)}
        </span>
        {contagem.pendentes > 0 ? (
          <span className="text-xs text-fysi-muted">
            o cliente ainda não respondeu essas
          </span>
        ) : null}
      </div>

      {erro ? (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-2.5 py-1.5"
        >
          {erro}
        </p>
      ) : null}

      {lista.length > 0 ? (
        <ul className="flex flex-col divide-y divide-fysi-line border-y border-fysi-line">
          {lista.map(({ pergunta: q, respondida, resumo }, i) => (
            <li key={q.id} className="py-2">
              {editingId === q.id ? (
                <div className="py-1">
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
                </div>
              ) : (
                <>
                  {/* UMA LINHA por pergunta. O que era um cartão com quatro
                      campos de formulário (Pergunta, Ajuda, Tipo, Opções)
                      virou texto; o resto mora no "⋯". */}
                  <div className="flex items-start gap-2">
                    <MarcaDaPergunta respondida={respondida} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-snug ${
                          respondida ? "text-fysi-muted" : "text-fysi-deep"
                        }`}
                      >
                        {q.label}
                      </p>
                      {resumo ? (
                        <p className="text-xs text-fysi-muted mt-0.5 line-clamp-2">
                          {resumo}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDetalhesDe(detalhesDe === q.id ? null : q.id)
                      }
                      aria-expanded={detalhesDe === q.id}
                      aria-label={`Opções de "${q.label}"`}
                      title="Opções"
                      className="shrink-0 h-6 w-6 grid place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition"
                    >
                      ⋯
                    </button>
                  </div>

                  {detalhesDe === q.id ? (
                    <div className="mt-2 ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fysi-muted">
                      <span>{tipoLabel(q.tipo)}</span>
                      {q.opcoes.length > 0 ? (
                        <span>{q.opcoes.length} opções</span>
                      ) : null}
                      {q.hint ? <span className="truncate max-w-xs">{q.hint}</span> : null}
                      <button
                        type="button"
                        onClick={() => setEditingId(q.id)}
                        disabled={pending}
                        className="underline underline-offset-2 hover:text-fysi-deep disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => move(q.id, "up")}
                        disabled={pending || i === 0}
                        className="underline underline-offset-2 hover:text-fysi-deep disabled:opacity-30"
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => move(q.id, "down")}
                        disabled={pending || i === lista.length - 1}
                        className="underline underline-offset-2 hover:text-fysi-deep disabled:opacity-30"
                      >
                        Descer
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(q.id, q.label)}
                        disabled={pending}
                        className="text-red-700 underline underline-offset-2 disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fysi-muted">
          Nenhuma pergunta específica ainda. Elas aparecem como um bloco extra
          no briefing deste cliente.
        </p>
      )}

      {/* "+ Adicionar" SEMPRE visível, e o formulário só abre no clique — o
          bloco "Nova pergunta" ficava permanentemente aberto no fim da
          lista, e três perguntas já ocupavam uma tela. */}
      {adicionando ? (
        <div className="bg-fysi-cream/40 border border-fysi-line rounded-[12px] p-3">
          <QuestionForm
            key={addKey}
            submitLabel="Adicionar pergunta"
            onSubmit={add}
            onCancel={() => setAdicionando(false)}
            pending={pending}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="self-start text-sm text-fysi-deep hover:underline underline-offset-2"
        >
          + Adicionar pergunta
        </button>
      )}
    </div>
  );
}

/** Quadradinho de estado — o mesmo da lista de materiais. */
function MarcaDaPergunta({ respondida }: { respondida: boolean }) {
  const base =
    "mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border grid place-items-center text-[0.6rem] font-bold";
  return respondida ? (
    <span
      className={`${base} border-fysi-deep bg-fysi-deep text-fysi-cream`}
      aria-label="Respondida"
      title="O cliente já respondeu"
    >
      ✓
    </span>
  ) : (
    <span
      className={`${base} border-fysi-line`}
      aria-label="Pendente"
      title="O cliente ainda não respondeu"
    />
  );
}
