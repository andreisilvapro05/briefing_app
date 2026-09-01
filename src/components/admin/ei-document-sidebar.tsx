"use client";

import { useState } from "react";
import Link from "next/link";
import { useTransition } from "react";
import type { EIDocumentSummary } from "@/lib/ei-documents";

/**
 * Sidebar do hub de documentos (EI ou Briefing — mesma tabela ei_documents,
 * kind diferente). Genérico via props (basePath/createAction/createLabel)
 * desde 2026-09-01, quando ganhou o hub de Briefing além do de EI.
 */
export function EIDocumentSidebar({
  docs,
  activeId,
  urlKey,
  clientsWithoutDoc,
  basePath = "/admin/estruturas-iniciais",
  createAction,
  createLabel = "+ Nova Estrutura Inicial",
}: {
  docs: EIDocumentSummary[];
  activeId: string;
  urlKey: string | null;
  clientsWithoutDoc: { id: string; nome: string | null; empresa: string | null }[];
  basePath?: string;
  createAction: (formData: FormData) => void | Promise<void>;
  createLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  function createFor(clientId: string) {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await createAction(fd);
    });
  }

  return (
    <aside className="w-[280px] shrink-0 border-r border-fysi-line bg-white flex flex-col h-full">
      <div className="p-3 border-b border-fysi-line flex flex-col gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar documento…"
          className="w-full rounded-[8px] border border-fysi-line bg-fysi-cream/40 text-sm px-3 py-1.5"
        />
        {clientsWithoutDoc.length > 0 ? (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="text-sm font-medium text-fysi-deep hover:text-fysi-green text-left"
          >
            {creating ? "Cancelar" : createLabel}
          </button>
        ) : null}
        {creating ? (
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-fysi-line bg-fysi-cream/30 p-2">
            <p className="text-xs uppercase tracking-[0.08em] text-fysi-muted px-1">
              Selecione o cliente
            </p>
            {clientsWithoutDoc.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => createFor(c.id)}
                className="text-left text-sm text-fysi-deep hover:text-fysi-green disabled:opacity-50 truncate"
              >
                {c.empresa || c.nome || "Sem nome"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {filtered.map((doc) => (
          <Link
            key={doc.id}
            href={`${basePath}/${doc.id}${kp}`}
            className={`flex items-center gap-2 px-3 py-2 text-sm truncate ${
              doc.id === activeId
                ? "bg-fysi-mint/40 text-fysi-deep font-medium"
                : "text-fysi-muted hover:bg-fysi-cream/60 hover:text-fysi-deep"
            }`}
          >
            {doc.isTemplate ? <span title="Modelo">★</span> : null}
            <span className="truncate">{doc.title}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
