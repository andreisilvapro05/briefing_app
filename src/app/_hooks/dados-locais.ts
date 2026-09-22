"use client";

import { useSyncExternalStore } from "react";
import { loadCliente } from "@/lib/storage";
import { getAllResponses } from "@/lib/briefing-store";
import type { Cliente } from "@/lib/types";

/**
 * Leitura do que está guardado no navegador (cliente do onboarding e
 * respostas do briefing) de um jeito que o React entende.
 *
 * Por que não `useState` + `useEffect`: o servidor não tem localStorage.
 * Lendo no efeito, o primeiro quadro sai vazio e "pula" pro valor salvo —
 * é justamente disso que a regra `react-hooks/set-state-in-effect`
 * reclama. Lendo direto no render, dá mismatch de hidratação.
 *
 * O padrão do projeto pra isso é `useSyncExternalStore` — o mesmo de
 * `use-grupos-colapsados.tsx` e do `useColumnWidths` em `tasks-board.tsx`:
 * o servidor rende o estado "vazio" e o cliente troca pelo valor salvo no
 * mesmo commit da hidratação, sem um render a mais.
 *
 * Pasta `_hooks`: o prefixo `_` tira a pasta do roteamento do App Router,
 * então isto fica colocado junto das telas que usam sem virar rota.
 */

/**
 * `loadCliente()` e `getAllResponses()` fazem `JSON.parse` a cada chamada,
 * ou seja, devolvem um objeto novo toda vez. `useSyncExternalStore` exige
 * que duas leituras seguidas do MESMO valor devolvam a MESMA referência —
 * senão é laço infinito de render. Este embrulho compara o conteúdo e só
 * troca a referência quando o conteúdo muda de verdade.
 */
function comReferenciaEstavel<T>(ler: () => T): () => T {
  let ultimoTexto: string | undefined;
  let ultimoValor: T;
  return () => {
    const valor = ler();
    const texto = JSON.stringify(valor ?? null);
    if (texto !== ultimoTexto) {
      ultimoTexto = texto;
      ultimoValor = valor;
    }
    return ultimoValor;
  };
}

/**
 * Só o evento `storage`, que o navegador dispara quando OUTRA aba mexe no
 * localStorage. Mudança feita na própria aba não precisa de aviso: quem
 * grava sempre navega ou muda estado logo em seguida, e aí o React relê o
 * snapshot no render seguinte.
 */
function assinar(aviso: () => void) {
  window.addEventListener("storage", aviso);
  return () => window.removeEventListener("storage", aviso);
}

/**
 * Três estados, e a diferença entre os dois últimos importa:
 * `undefined` = ainda não deu pra olhar o navegador (servidor/hidratação),
 * `null`      = olhei e não tem cliente nenhum,
 * `Cliente`   = tem.
 *
 * Sem esse `undefined`, as telas que redirecionam quem não tem cliente
 * mandariam todo mundo pra "/" no primeiro quadro da hidratação, quando o
 * valor ainda é o do servidor.
 */
export type ClienteLocal = Cliente | null | undefined;

const lerCliente = comReferenciaEstavel(loadCliente);
const clienteNoServidor = (): ClienteLocal => undefined;

/** O cliente guardado neste navegador. Ver `ClienteLocal` pros 3 estados. */
export function useClienteLocal(): ClienteLocal {
  return useSyncExternalStore(assinar, lerCliente, clienteNoServidor);
}

/** Objeto vazio estável: `getServerSnapshot` precisa da mesma referência. */
const SEM_RESPOSTAS: Record<string, unknown> = {};

const lerRespostas = comReferenciaEstavel(getAllResponses);
const respostasNoServidor = () => SEM_RESPOSTAS;

/** As respostas do briefing guardadas neste navegador. */
export function useRespostasBriefing(): Record<string, unknown> {
  return useSyncExternalStore(assinar, lerRespostas, respostasNoServidor);
}
