"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProcessDocRow } from "@/app/admin/processos/page";

export function ProcessDocsExplorer({ docs }: { docs: ProcessDocRow[] }) {
  const [audiencia, setAudiencia] = useState<"equipe" | "cliente">("equipe");
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<ProcessDocRow | null>(null);

  const equipeCount = docs.filter((d) => d.audiencia === "equipe").length;
  const clienteCount = docs.filter((d) => d.audiencia === "cliente").length;

  const scoped = useMemo(
    () => docs.filter((d) => d.audiencia === audiencia),
    [docs, audiencia]
  );

  const categorias = useMemo(() => {
    const set = new Set(scoped.map((d) => d.categoria));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((d) => {
      if (categoria && d.categoria !== categoria) return false;
      if (!q) return true;
      return (
        d.titulo.toLowerCase().includes(q) ||
        d.categoria.toLowerCase().includes(q) ||
        (d.descricao ?? "").toLowerCase().includes(q)
      );
    });
  }, [scoped, query, categoria]);

  function switchAudiencia(next: "equipe" | "cliente") {
    setAudiencia(next);
    setCategoria(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 w-fit rounded-full border border-fysi-line bg-white p-1">
        <button
          type="button"
          onClick={() => switchAudiencia("equipe")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            audiencia === "equipe"
              ? "bg-fysi-deep text-fysi-cream"
              : "text-fysi-muted hover:bg-fysi-cream"
          }`}
        >
          Equipe ({equipeCount})
        </button>
        <button
          type="button"
          onClick={() => switchAudiencia("cliente")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            audiencia === "cliente"
              ? "bg-fysi-deep text-fysi-cream"
              : "text-fysi-muted hover:bg-fysi-cream"
          }`}
        >
          Cliente ({clienteCount})
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por título, categoria ou conteúdo…"
        className="rounded-[12px] border border-fysi-line bg-white px-4 py-2.5 text-sm text-fysi-deep placeholder:text-fysi-muted focus:outline-none focus:border-fysi-deep/40"
      />

      {categorias.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoria(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              categoria === null
                ? "bg-fysi-deep text-fysi-cream border-fysi-deep"
                : "bg-white text-fysi-deep border-fysi-line hover:border-fysi-deep/40"
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                categoria === c
                  ? "bg-fysi-deep text-fysi-cream border-fysi-deep"
                  : "bg-white text-fysi-deep border-fysi-line hover:border-fysi-deep/40"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-fysi-muted">
        {filtered.length} de {scoped.length}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-fysi-muted bg-white border border-fysi-line rounded-[16px] p-8 text-center">
          Nada encontrado.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <ProcessDocCard key={d.id} doc={d} onOpen={() => setOpenDoc(d)} />
          ))}
        </div>
      )}

      {openDoc ? (
        <ProcessDocModal doc={openDoc} onClose={() => setOpenDoc(null)} />
      ) : null}
    </div>
  );
}

/** Card compacto, estilo ClickUp — clica em qualquer lugar pra abrir o detalhe. */
function ProcessDocCard({
  doc,
  onOpen,
}: {
  doc: ProcessDocRow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-white border border-fysi-line rounded-[16px] p-4 flex flex-col gap-2 hover:border-fysi-deep/40 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-fysi-deep leading-snug">
          {doc.titulo}
        </h3>
        <span className="shrink-0 rounded-full bg-fysi-cream/70 text-fysi-muted text-xs font-medium capitalize px-2 py-0.5">
          {doc.categoria}
        </span>
      </div>

      {doc.descricao ? (
        <p className="text-xs text-fysi-muted leading-relaxed line-clamp-2">
          {doc.descricao}
        </p>
      ) : null}

      {doc.link ? (
        <span className="text-xs font-medium text-fysi-muted mt-1">
          🔗 tem link
        </span>
      ) : null}
    </button>
  );
}

/** Detalhe em card sobreposto (estilo ClickUp) — abre ao clicar num item. */
function ProcessDocModal({
  doc,
  onClose,
}: {
  doc: ProcessDocRow;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-[8vh] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-fysi-line">
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-fysi-cream/70 text-fysi-muted text-xs font-medium capitalize px-2.5 py-0.5 mb-2">
              {doc.categoria}
            </span>
            <h2 className="text-lg font-semibold text-fysi-deep leading-snug">
              {doc.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-fysi-muted hover:bg-fysi-cream hover:text-fysi-deep transition"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
          {doc.descricao ? (
            <p className="text-sm text-fysi-deep leading-relaxed whitespace-pre-wrap">
              {doc.descricao}
            </p>
          ) : !doc.link ? (
            <p className="text-sm text-fysi-muted italic">
              Sem conteúdo registrado pra esse item ainda.
            </p>
          ) : null}

          {doc.link ? (
            <a
              href={doc.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start rounded-full bg-fysi-mint-vivid text-fysi-deep text-sm font-semibold px-4 py-2 hover:brightness-95 transition"
            >
              🔗 Abrir link →
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
