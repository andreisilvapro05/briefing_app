"use client";

import { useState } from "react";
import Link from "next/link";
import { useTransition } from "react";
import { createEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";
import type { EIDocumentSummary } from "@/lib/ei-documents";

export function EIDocumentSidebar({
  docs,
  activeId,
  urlKey,
  clientsWithoutDoc,
}: {
  docs: EIDocumentSummary[];
  activeId: string;
  urlKey: string | null;
  clientsWithoutDoc: { id: string; nome: string | null; empresa: string | null }[];
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
      await createEIDocumentAction(fd);
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
            + Nova Estrutura Inicial
          </button>
        ) : null}
        {creating ? (
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-fysi-line bg-fysi-cream/30 p-2">
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
            href={`/admin/estruturas-iniciais/${doc.id}${kp}`}
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
