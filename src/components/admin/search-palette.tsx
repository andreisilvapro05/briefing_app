"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  globalSearchAction,
  type GlobalSearchResults,
} from "@/app/admin/actions";
import { TASK_STATUS_OPTIONS } from "@/lib/project-tasks";

const EMPTY: GlobalSearchResults = { clientes: [], tarefas: [], documentos: [] };

/**
 * Busca global (Cmd/Ctrl+K) — modal com resultados categorizados
 * (Clientes/Tarefas/Documentos), estilo command palette do ClickUp.
 * Pedido do usuário 2026-08-31 (print da busca do ClickUp).
 */
export function SearchPalette({
  keyParam,
  urlKey,
}: {
  keyParam: string;
  urlKey?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(EMPTY);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearchAction(q, urlKey ?? null);
        setResults(r);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, urlKey]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const hasQuery = query.trim().length >= 2;
  const hasResults =
    results.clientes.length + results.tarefas.length + results.documentos.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 w-full max-w-md rounded-full border border-fysi-line bg-fysi-cream/40 px-4 py-2.5 text-sm text-fysi-muted hover:border-fysi-deep/30 hover:text-fysi-deep hover:bg-fysi-cream/70 transition"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="hidden sm:inline flex-1 text-left truncate">
          Buscar cliente, tarefa ou documento…
        </span>
        <span className="sm:hidden flex-1 text-left">Buscar…</span>
        <kbd className="hidden sm:inline text-xs border border-fysi-line rounded px-1.5 py-0.5 bg-white shrink-0">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-[12vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-[16px] shadow-2xl w-full max-w-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-fysi-line">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fysi-muted shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, tarefa ou documento…"
                className="flex-1 text-sm text-fysi-deep placeholder:text-fysi-muted focus:outline-none"
              />
              <kbd className="text-xs text-fysi-muted border border-fysi-line rounded px-1 py-0.5">
                Esc
              </kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto py-2">
              {!hasQuery ? (
                <p className="text-sm text-fysi-muted text-center py-8">
                  Digite pelo menos 2 letras pra buscar.
                </p>
              ) : pending && !hasResults ? (
                <p className="text-sm text-fysi-muted text-center py-8">Buscando…</p>
              ) : !hasResults ? (
                <p className="text-sm text-fysi-muted text-center py-8">
                  Nada encontrado pra &quot;{query}&quot;.
                </p>
              ) : (
                <>
                  {results.clientes.length > 0 ? (
                    <ResultGroup label="Clientes">
                      {results.clientes.map((c) => (
                        <ResultRow
                          key={c.id}
                          onClick={() => go(`/admin/${c.id}${keyParam}`)}
                          title={c.nome}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}

                  {results.tarefas.length > 0 ? (
                    <ResultGroup label="Tarefas">
                      {results.tarefas.map((t) => (
                        <ResultRow
                          key={t.id}
                          onClick={() =>
                            go(`/admin/${t.clientId}?tab=tarefas${keyParam ? `&${keyParam.slice(1)}` : ""}`)
                          }
                          title={t.titulo}
                          subtitle={`${t.clientNome} · ${TASK_STATUS_OPTIONS.find((o) => o.value === t.status)?.label ?? t.status}`}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}

                  {results.documentos.length > 0 ? (
                    <ResultGroup label="Documentos">
                      {results.documentos.map((d) => (
                        <ResultRow
                          key={d.id}
                          onClick={() =>
                            d.kind === "ei"
                              ? go(`/admin/estruturas-iniciais/${d.id}${keyParam}`)
                              : go(`/admin/${d.clientId}?tab=briefing${keyParam ? `&${keyParam.slice(1)}` : ""}`)
                          }
                          title={d.clientNome}
                          subtitle={d.kind === "ei" ? "Estrutura Inicial" : "Briefing"}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-4 py-1 text-xs uppercase tracking-[0.1em] text-fysi-muted font-semibold">
        {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({
  onClick,
  title,
  subtitle,
}: {
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col w-full text-left px-4 py-2 hover:bg-fysi-cream/60 transition"
    >
      <span className="text-sm text-fysi-deep font-medium truncate">{title}</span>
      {subtitle ? (
        <span className="text-xs text-fysi-muted truncate">{subtitle}</span>
      ) : null}
    </button>
  );
}
