"use client";

import { useMemo, useState } from "react";
import type { ProcessDocRow } from "@/app/admin/processos/page";

const DESCRICAO_PREVIEW_LEN = 220;

export function ProcessDocsExplorer({ docs }: { docs: ProcessDocRow[] }) {
  const [audiencia, setAudiencia] = useState<"equipe" | "cliente">("equipe");
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

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
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((d) => (
            <ProcessDocCard key={d.id} doc={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessDocCard({ doc }: { doc: ProcessDocRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasLongDescricao = (doc.descricao?.length ?? 0) > DESCRICAO_PREVIEW_LEN;
  const descricaoShown =
    !doc.descricao || (!expanded && hasLongDescricao)
      ? doc.descricao?.slice(0, DESCRICAO_PREVIEW_LEN)
      : doc.descricao;

  return (
    <div className="bg-white border border-fysi-line rounded-[16px] p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-fysi-deep leading-snug">
          {doc.titulo}
        </h3>
        <span className="shrink-0 rounded-full bg-fysi-cream/70 text-fysi-muted text-[0.68rem] font-medium capitalize px-2 py-0.5">
          {doc.categoria}
        </span>
      </div>

      {descricaoShown ? (
        <p className="text-xs text-fysi-muted leading-relaxed whitespace-pre-wrap">
          {descricaoShown}
          {!expanded && hasLongDescricao ? "…" : ""}
        </p>
      ) : null}

      <div className="flex items-center gap-3 mt-1">
        {hasLongDescricao ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-fysi-deep hover:underline"
          >
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        ) : null}
        {doc.link ? (
          <a
            href={doc.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-fysi-deep underline underline-offset-2 hover:text-fysi-green"
          >
            🔗 Abrir link →
          </a>
        ) : null}
      </div>
    </div>
  );
}
