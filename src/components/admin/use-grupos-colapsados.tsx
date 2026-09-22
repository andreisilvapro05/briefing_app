"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Abrir e fechar os grupos de uma lista, como no ClickUp — onde clicar na
 * pílula do status recolhe aquele bloco inteiro.
 *
 * Pedido da Karine (2026-09-22): "poder abrir e fechar cada status com as
 * tarefas, só na parte de visualização". A tela de Tarefas mostra todos os
 * status empilhados; quem está tocando implementação não quer rolar por
 * "Concluído: 67" pra achar os três itens que interessam.
 *
 * "Só na parte de visualização": fechar um grupo não muda nada no banco. A
 * escolha fica no localStorage do navegador — é preferência de quem olha,
 * não estado do projeto, e cada pessoa tem a sua.
 *
 * Por que useSyncExternalStore e não useState + useEffect: o servidor não
 * tem localStorage. Lendo no efeito, o primeiro quadro vem com tudo aberto e
 * "pula" pro estado salvo; lendo no render, dá mismatch de hidratação
 * (ver [[bug_hydration_lista_visao_geral]]). Aqui o servidor rende sempre
 * "tudo aberto" e o cliente troca no mesmo commit da hidratação.
 */

const cache = new Map<string, Set<string>>();
const ouvintes = new Set<() => void>();
/** Set vazio estável: getServerSnapshot precisa devolver sempre a mesma ref. */
const VAZIO: ReadonlySet<string> = new Set<string>();

function ler(chave: string): Set<string> {
  const emCache = cache.get(chave);
  if (emCache) return emCache;
  let valor = new Set<string>();
  try {
    const cru = localStorage.getItem(chave);
    if (cru) {
      const arr: unknown = JSON.parse(cru);
      if (Array.isArray(arr)) valor = new Set(arr.filter((v) => typeof v === "string"));
    }
  } catch {
    /* localStorage bloqueado (aba anônima): vale só esta sessão. */
  }
  cache.set(chave, valor);
  return valor;
}

function gravar(chave: string, valor: Set<string>) {
  cache.set(chave, valor);
  try {
    localStorage.setItem(chave, JSON.stringify([...valor]));
  } catch {
    /* idem. */
  }
  for (const o of ouvintes) o();
}

function subscribe(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

export interface GruposColapsados {
  /** true = grupo recolhido (só o cabeçalho aparece). */
  fechado: (id: string) => boolean;
  alternar: (id: string) => void;
  abrirTodos: () => void;
  fecharTodos: (ids: string[]) => void;
  /** Quantos dos grupos visíveis estão fechados — pro botão dizer o que faz. */
  totalFechados: (ids: string[]) => number;
}

export function useGruposColapsados(storageKey: string): GruposColapsados {
  const getSnapshot = useCallback(() => ler(storageKey), [storageKey]);
  const getServerSnapshot = useCallback(() => VAZIO as Set<string>, []);
  const set = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      fechado: (id: string) => set.has(id),
      alternar: (id: string) => {
        const proximo = new Set(ler(storageKey));
        if (proximo.has(id)) proximo.delete(id);
        else proximo.add(id);
        gravar(storageKey, proximo);
      },
      abrirTodos: () => gravar(storageKey, new Set()),
      fecharTodos: (ids: string[]) => gravar(storageKey, new Set(ids)),
      totalFechados: (ids: string[]) => ids.filter((id) => set.has(id)).length,
    }),
    [set, storageKey]
  );
}

/** Triângulo do cabeçalho — aponta pra baixo quando aberto, como no ClickUp. */
export function Caret({ aberto }: { aberto: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-150 ${
        aberto ? "" : "-rotate-90"
      }`}
    >
      <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
