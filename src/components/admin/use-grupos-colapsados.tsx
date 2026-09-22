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

/**
 * Guardamos a ESCOLHA de cada grupo (`true` = fechado), não só o conjunto
 * dos fechados. É a diferença entre "nunca mexeram nisso" e "mandaram
 * fechar": sem ela, um grupo que nasce fechado por padrão (as tarefas sem
 * data, que são dezenas) não teria como ser mantido aberto.
 */
type Escolhas = Record<string, boolean>;

const cache = new Map<string, Escolhas>();
const ouvintes = new Set<() => void>();
/** Objeto vazio estável: getServerSnapshot precisa da mesma referência. */
const VAZIO: Escolhas = {};

function ler(chave: string): Escolhas {
  const emCache = cache.get(chave);
  if (emCache) return emCache;
  let valor: Escolhas = {};
  try {
    const cru = localStorage.getItem(chave);
    if (cru) {
      const bruto: unknown = JSON.parse(cru);
      if (bruto && typeof bruto === "object" && !Array.isArray(bruto)) {
        for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
          if (typeof v === "boolean") valor[k] = v;
        }
      } else if (Array.isArray(bruto)) {
        // Formato antigo (lista dos fechados) — migra sem perder a escolha.
        valor = Object.fromEntries(
          bruto.filter((v) => typeof v === "string").map((v) => [v as string, true])
        );
      }
    }
  } catch {
    /* localStorage bloqueado (aba anônima): vale só esta sessão. */
  }
  cache.set(chave, valor);
  return valor;
}

function gravar(chave: string, valor: Escolhas) {
  cache.set(chave, valor);
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
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
  /**
   * true = grupo recolhido. `padraoFechado` vale enquanto ninguém tiver
   * mexido naquele grupo.
   */
  fechado: (id: string, padraoFechado?: boolean) => boolean;
  alternar: (id: string, padraoFechado?: boolean) => void;
  abrirTodos: (ids: string[]) => void;
  fecharTodos: (ids: string[]) => void;
  /** Quantos dos grupos dados estão fechados — pro botão dizer o que faz. */
  totalFechados: (ids: string[]) => number;
}

export function useGruposColapsados(storageKey: string): GruposColapsados {
  const getSnapshot = useCallback(() => ler(storageKey), [storageKey]);
  const getServerSnapshot = useCallback(() => VAZIO, []);
  const escolhas = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    const fechado = (id: string, padraoFechado = false) =>
      id in escolhas ? escolhas[id] : padraoFechado;
    return {
      fechado,
      alternar: (id: string, padraoFechado = false) => {
        const atual = ler(storageKey);
        const estava = id in atual ? atual[id] : padraoFechado;
        gravar(storageKey, { ...atual, [id]: !estava });
      },
      abrirTodos: (ids: string[]) => {
        const proximo = { ...ler(storageKey) };
        for (const id of ids) proximo[id] = false;
        gravar(storageKey, proximo);
      },
      fecharTodos: (ids: string[]) => {
        const proximo = { ...ler(storageKey) };
        for (const id of ids) proximo[id] = true;
        gravar(storageKey, proximo);
      },
      totalFechados: (ids: string[]) => ids.filter((id) => fechado(id)).length,
    };
  }, [escolhas, storageKey]);
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
