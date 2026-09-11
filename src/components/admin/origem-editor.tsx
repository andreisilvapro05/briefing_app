"use client";

import { useState, useTransition } from "react";
import { ORIGENS, origemLabel, origemOpcao } from "@/lib/origem";
import { setClientOrigemAction } from "@/app/admin/[id]/actions";

/**
 * "De onde o cliente veio" na ficha — visível de relance e editável em dois
 * cliques. O cliente escolhe na primeira tela (obrigatório), mas o time
 * precisa poder corrigir ou detalhar: quem chega por indicação costuma
 * dizer de QUEM só na conversa.
 */
export function OrigemEditor({
  clientId,
  urlKey,
  valorInicial,
}: {
  clientId: string;
  urlKey?: string;
  valorInicial: string | null;
}) {
  const [valor, setValor] = useState(valorInicial ?? "");
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState(false);

  function salvar(novo: string) {
    const anterior = valor;
    setValor(novo);
    setEditando(false);
    setErro(false);
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("origem", novo);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      try {
        await setClientOrigemAction(fd);
      } catch {
        setValor(anterior);
        setErro(true);
      }
    });
  }

  if (!editando) {
    return (
      <span className="inline-flex items-center gap-2">
        {valor ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              origemOpcao(valor)?.ativo ??
              "bg-fysi-cream border-fysi-line text-fysi-deep"
            }`}
          >
            <span aria-hidden="true">{origemOpcao(valor)?.emoji ?? "📍"}</span>
            {origemLabel(valor)}
          </span>
        ) : (
          <span className="text-xs text-amber-700">origem não informada</span>
        )}
        <button
          type="button"
          onClick={() => setEditando(true)}
          disabled={pending}
          className="text-[0.7rem] text-fysi-muted hover:text-fysi-deep underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? "salvando…" : "editar"}
        </button>
        {erro ? (
          <span className="text-[0.7rem] text-red-600">não salvou</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        autoFocus
        defaultValue={valor}
        onChange={(e) => salvar(e.target.value)}
        className="rounded-[8px] border border-fysi-line bg-white px-2 py-1 text-xs text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
      >
        <option value="">Não informado</option>
        {ORIGENS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.emoji} {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setEditando(false)}
        className="text-[0.7rem] text-fysi-muted hover:text-fysi-deep"
      >
        cancelar
      </button>
    </span>
  );
}
