"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  globalSearchAction,
  type GlobalSearchResults,
} from "@/app/admin/actions";
import { TASK_STATUS_OPTIONS } from "@/lib/project-tasks";
import { useFocusTrap } from "./use-focus-trap";

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
  const [lastResults, setLastResults] = useState<GlobalSearchResults>(EMPTY);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  // Abrir já limpa a busca anterior: o reset vive aqui, no gesto, e não num
  // efeito que rodava depois do render (setState em cascata).
  const abrir = useCallback(() => {
    setQuery("");
    setLastResults(EMPTY);
    setOpen(true);
  }, []);
  const fechar = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) fechar();
        else abrir();
      } else if (e.key === "Escape") {
        fechar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, abrir, fechar]);

  // Foco no campo quando abre — mexer no DOM é justamente o que um efeito faz.
  useEffect(() => {
    if (!open) return;
    const quadro = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(quadro);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    // Menos de 2 letras não busca; e a lista some por conta do `results`
    // derivado abaixo, sem precisar zerar estado aqui dentro.
    if (q.length < 2) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearchAction(q, urlKey ?? null);
        setLastResults(r);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, urlKey]);

  function go(href: string) {
    fechar();
    router.push(href);
  }

  const hasQuery = query.trim().length >= 2;
  // Apagar a busca esconde os resultados na hora, sem esperar um efeito.
  const results = hasQuery ? lastResults : EMPTY;
  const hasResults =
    results.clientes.length + results.tarefas.length + results.documentos.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
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
          onClick={fechar}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label="Busca"
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
