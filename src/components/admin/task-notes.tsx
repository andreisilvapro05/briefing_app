"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getTaskLinkTargetsAction } from "@/app/admin/[id]/actions";
import type { LinkTarget } from "@/lib/task-links";

/**
 * Campo de observações da demanda com o atalho "/" do ClickUp: digitar "/"
 * abre a lista de páginas DO APP (Estrutura Inicial, briefing, ficha,
 * moodboard, entrega, drives) e escolher insere um link nomeado no texto.
 *
 * Por que isso existe: no ClickUp a tarefa "Copy LP Raynna" carrega as
 * páginas do cliente ao lado; aqui, quem pegava a demanda tinha um campo de
 * notas em branco e precisava caçar no menu onde estava o briefing daquele
 * cliente — ou colar uma URL gigante na mão.
 *
 * O texto continua sendo markdown simples num <textarea>: um editor de
 * blocos aqui pesaria a linha da tabela, que renderiza dezenas de vezes.
 */
export function TaskNotes({
  value,
  onChange,
  onBlur,
  disabled,
  clientId,
  urlKey,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
  clientId: string | null;
  urlKey?: string | null;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [destinos, setDestinos] = useState<LinkTarget[] | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState(false);
  /** Onde estava a "/" que abriu o menu — é o trecho substituído. */
  const barraPos = useRef<number | null>(null);

  useEffect(() => {
    if (!menuAberto || destinos !== null) return;
    let vivo = true;
    getTaskLinkTargetsAction(clientId, urlKey ?? null)
      .then((d) => {
        if (vivo) setDestinos(d);
      })
      .catch(() => {
        if (vivo) {
          setErro(true);
          setDestinos([]);
        }
      });
    return () => {
      vivo = false;
    };
  }, [menuAberto, destinos, clientId, urlKey]);

  const filtrados = useMemo(() => {
    const lista = destinos ?? [];
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((d) => d.label.toLowerCase().includes(q));
  }, [destinos, busca]);

  function fechar() {
    setMenuAberto(false);
    setBusca("");
    barraPos.current = null;
  }

  function inserir(alvo: LinkTarget) {
    const area = areaRef.current;
    const pos = barraPos.current;
    const markdown = `[${alvo.label}](${alvo.href})`;

    if (area && pos !== null) {
      // Substitui a "/" e o que foi digitado depois dela.
      const antes = value.slice(0, pos);
      const depois = value.slice(pos + 1 + busca.length);
      const novo = `${antes}${markdown}${depois}`;
      onChange(novo);
      fechar();
      // Cursor logo depois do link inserido.
      requestAnimationFrame(() => {
        const cursor = antes.length + markdown.length;
        area.focus();
        area.setSelectionRange(cursor, cursor);
      });
      return;
    }

    onChange(value ? `${value}\n${markdown}` : markdown);
    fechar();
  }

  return (
    <div className="relative">
      <textarea
        ref={areaRef}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const novo = e.target.value;
          const cursor = e.target.selectionStart;
          // "/" abre o menu quando está no começo da linha ou depois de um
          // espaço — assim uma URL ("https://…") não dispara o menu.
          if (novo.length === value.length + 1) {
            const digitado = novo[cursor - 1];
            const anterior = cursor >= 2 ? novo[cursor - 2] : "\n";
            if (digitado === "/" && (anterior === "\n" || anterior === " " || cursor === 1)) {
              barraPos.current = cursor - 1;
              setBusca("");
              setMenuAberto(true);
            }
          }
          if (menuAberto && barraPos.current !== null) {
            const depoisDaBarra = novo.slice(barraPos.current + 1, cursor);
            if (depoisDaBarra.includes(" ") || depoisDaBarra.includes("\n")) fechar();
            else setBusca(depoisDaBarra);
          }
          onChange(novo);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && menuAberto) {
            e.preventDefault();
            e.stopPropagation();
            fechar();
          }
          if (e.key === "Enter" && menuAberto && filtrados.length > 0) {
            e.preventDefault();
            inserir(filtrados[0]);
          }
        }}
        onBlur={() => {
          // Sem o atraso, clicar num item do menu fecharia antes do clique.
          window.setTimeout(() => {
            if (!menuAberto) onBlur();
          }, 0);
        }}
        placeholder="Notas, contexto e links. Digite / pra vincular uma página do app."
        rows={3}
        className="w-full rounded-[8px] border border-fysi-line bg-white text-sm px-3 py-2 focus:outline-none focus:border-fysi-deep/40 resize-y"
      />

      {menuAberto ? (
        <div
          role="listbox"
          aria-label="Vincular página"
          className="absolute z-40 left-3 top-full -mt-1 w-72 max-h-64 overflow-y-auto rounded-[12px] border border-fysi-line bg-white shadow-xl py-1"
        >
          {destinos === null ? (
            <p className="px-3 py-2 text-xs text-fysi-muted">Carregando…</p>
          ) : erro ? (
            <p className="px-3 py-2 text-xs text-red-700">
              Não consegui carregar as páginas.
            </p>
          ) : filtrados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-fysi-muted">
              Nada com esse nome.
            </p>
          ) : (
            filtrados.map((d, i) => (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={i === 0}
                // onMouseDown: o clique precisa acontecer antes do blur do
                // textarea, senão o menu some sem inserir nada.
                onMouseDown={(e) => {
                  e.preventDefault();
                  inserir(d);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fysi-cream ${
                  i === 0 ? "bg-fysi-cream/60" : ""
                }`}
              >
                <span className="truncate text-fysi-deep">{d.label}</span>
                {!d.existe ? (
                  <span className="ml-auto shrink-0 text-[0.62rem] uppercase tracking-[0.08em] text-amber-700">
                    criar
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Links markdown `[nome](url)` do texto — viram chips clicáveis. */
export function extrairLinks(
  texto: string
): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const vistos = new Set<string>();

  const markdown = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = markdown.exec(texto))) {
    if (vistos.has(m[2])) continue;
    vistos.add(m[2]);
    out.push({ label: m[1], url: m[2] });
  }

  // URLs soltas que não fazem parte de um link markdown — o texto antigo é
  // todo assim, e continuar mostrando é melhor que fazer sumir.
  const cru = /https?:\/\/[^\s<>"')\]]+/g;
  while ((m = cru.exec(texto))) {
    if (vistos.has(m[0])) continue;
    const antes = texto.slice(Math.max(0, m.index - 2), m.index);
    if (antes.endsWith("](")) continue;
    vistos.add(m[0]);
    out.push({ label: m[0], url: m[0] });
  }

  return out;
}
