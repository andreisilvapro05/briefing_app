"use client";

import { useState } from "react";
import type { ProcessDocRow } from "@/app/admin/processos/page";
import {
  createProcessDocAction,
  updateProcessDocAction,
} from "@/app/admin/processos/actions";
import { SubmitButton } from "./submit-button";

/**
 * Formulário de criar/editar um processo. Usado tanto no botão "+ Novo"
 * quanto dentro do card de detalhe (modo edição). Server Action direta —
 * sem estado otimista, porque a lista recarrega via revalidatePath.
 */
export function ProcessDocForm({
  doc,
  urlKey,
  audienciaPadrao,
  categorias,
  onCancel,
}: {
  /** Sem `doc` = criação. */
  doc?: ProcessDocRow;
  urlKey: string | null;
  audienciaPadrao: "equipe" | "cliente";
  /** Categorias já existentes, pra sugerir no datalist. */
  categorias: string[];
  onCancel?: () => void;
}) {
  const editando = !!doc;
  const [audiencia, setAudiencia] = useState<"equipe" | "cliente">(
    doc?.audiencia ?? audienciaPadrao
  );

  const campo =
    "w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40";
  const rotulo =
    "text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold";

  return (
    <form
      action={editando ? updateProcessDocAction : createProcessDocAction}
      className="flex flex-col gap-3"
    >
      {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
      {doc ? <input type="hidden" name="id" value={doc.id} /> : null}

      <label className="flex flex-col gap-1">
        <span className={rotulo}>Título</span>
        <input
          name="titulo"
          required
          maxLength={200}
          defaultValue={doc?.titulo ?? ""}
          placeholder="Ex: Como apontar o domínio na hospedagem"
          className={campo}
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Categoria</span>
          <input
            name="categoria"
            list="processo-categorias"
            defaultValue={doc?.categoria ?? ""}
            placeholder="Ex: hospedagem"
            className={campo}
          />
          <datalist id="processo-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <div className="flex flex-col gap-1">
          <span className={rotulo}>Para quem</span>
          <div className="flex gap-1.5 rounded-full border border-fysi-line bg-white p-1 w-fit">
            {(["equipe", "cliente"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudiencia(a)}
                className={`rounded-full px-3.5 py-1 text-sm font-medium capitalize transition ${
                  audiencia === a
                    ? "bg-fysi-deep text-fysi-cream"
                    : "text-fysi-muted hover:bg-fysi-cream"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <input type="hidden" name="audiencia" value={audiencia} />
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={rotulo}>Link (opcional)</span>
        <input
          name="link"
          defaultValue={doc?.link ?? ""}
          placeholder="clickup.com/… ou drive.google.com/…"
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={rotulo}>Conteúdo</span>
        <textarea
          name="descricao"
          rows={8}
          defaultValue={doc?.descricao ?? ""}
          placeholder="Passo a passo do processo…"
          className={`${campo} resize-y`}
        />
      </label>

      <div className="flex items-center gap-2">
        <SubmitButton size="sm" pendingLabel={editando ? "Salvando…" : "Criando…"}>
          {editando ? "Salvar alterações" : "Criar processo"}
        </SubmitButton>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-fysi-muted hover:text-fysi-deep"
          >
            cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
