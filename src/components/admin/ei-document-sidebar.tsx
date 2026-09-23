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
  subTabs,
}: {
  docs: EIDocumentSummary[];
  activeId: string;
  urlKey: string | null;
  clientsWithoutDoc: { id: string; nome: string | null; empresa: string | null }[];
  basePath?: string;
  createAction: (formData: FormData) => void | Promise<void>;
  createLabel?: string;
  // Sub-abas no topo da sidebar (ex: Respostas / Documentos, no hub de
  // Briefing) — pedido do usuário 2026-09-01 pra "Documentos de Briefing"
  // ficar junto de "Briefings", não solto como área própria.
  subTabs?: { label: string; href: string; active: boolean }[];
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [verArquivo, setVerArquivo] = useState(false);
  const [pending, startTransition] = useTransition();

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const busca = query.trim().toLowerCase();
  const filtered = docs.filter((d) => d.title.toLowerCase().includes(busca));
  // Ativos e arquivo em blocos separados. A BUSCA alcança os dois: quem
  // digita o nome de um ex-cliente quer achá-lo, e é justamente pra isso
  // que o arquivo existe. Sem busca, o arquivo fica recolhido — são
  // centenas de páginas importadas do ClickUp, e uma lista plana com todas
  // ficaria pior do que era antes de importar.
  const ativos = filtered.filter((d) => !d.arquivado);
  const arquivados = filtered.filter((d) => d.arquivado);
  const buscando = busca.length > 0;

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
      {subTabs ? (
        <div className="flex gap-1 p-2 border-b border-fysi-line">
          {subTabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 text-center rounded-[8px] px-2 py-1.5 text-xs font-medium transition ${
                t.active
                  ? "bg-fysi-deep text-fysi-cream"
                  : "text-fysi-muted hover:bg-fysi-cream/60"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}
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
        {ativos.map((doc) => (
          <ItemDoc
            key={doc.id}
            doc={doc}
            ativo={doc.id === activeId}
            href={`${basePath}/${doc.id}${kp}`}
          />
        ))}

        {ativos.length === 0 && !buscando ? (
          <p className="px-3 py-2 text-xs text-fysi-muted">
            Nenhum documento ativo.
          </p>
        ) : null}

        {arquivados.length > 0 ? (
          <div className="mt-1 border-t border-fysi-line pt-1">
            <button
              type="button"
              onClick={() => setVerArquivo((v) => !v)}
              aria-expanded={buscando || verArquivo}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-[0.08em] text-fysi-muted hover:text-fysi-deep"
            >
              <span
                className={`transition-transform ${
                  buscando || verArquivo ? "" : "-rotate-90"
                }`}
                aria-hidden
              >
                <svg width="9" height="9" viewBox="0 0 10 10">
                  <path
                    d="M1 3l4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Arquivo
              <span className="ml-auto tabular-nums normal-case tracking-normal">
                {arquivados.length}
              </span>
            </button>
            {/* Buscando, o arquivo abre sozinho: quem digitou o nome de um
                ex-cliente está procurando exatamente ali. */}
            {buscando || verArquivo
              ? arquivados.map((doc) => (
                  <ItemDoc
                    key={doc.id}
                    doc={doc}
                    ativo={doc.id === activeId}
                    href={`${basePath}/${doc.id}${kp}`}
                    apagado
                  />
                ))
              : null}
          </div>
        ) : null}

        {buscando && filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-fysi-muted">
            Nada com esse nome, nem no arquivo.
          </p>
        ) : null}
      </nav>
    </aside>
  );
}

/** Uma linha da barra lateral. `apagado` = está no arquivo. */
function ItemDoc({
  doc,
  ativo,
  href,
  apagado = false,
}: {
  doc: EIDocumentSummary;
  ativo: boolean;
  href: string;
  apagado?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 text-sm truncate ${
        ativo
          ? "bg-fysi-mint/40 text-fysi-deep font-medium"
          : apagado
            ? "text-fysi-muted/70 hover:bg-fysi-cream/60 hover:text-fysi-deep"
            : "text-fysi-muted hover:bg-fysi-cream/60 hover:text-fysi-deep"
      }`}
    >
      {doc.isTemplate ? <span title="Modelo">★</span> : null}
      <span className="truncate">{doc.title}</span>
    </Link>
  );
}
