"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadCliente } from "./storage";

/**
 * Persistência das respostas do briefing.
 * Em modo demo (sem Supabase) usa localStorage. Em produção, envia para
 * /api/briefing/save (autenticado) que escreve em briefing_responses.
 */

const STORAGE_KEY = "fysi.briefing.responses.v1";

// Aceita qualquer valor JSON-serializável: strings, números, listas, objetos aninhados.
// Usamos `unknown` para máxima flexibilidade — os componentes garantem o tipo correto.
type ResponseValue = unknown;

type ResponsesMap = Record<string, ResponseValue>;

function readAll(): ResponsesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResponsesMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: ResponsesMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getResponse<T>(fieldId: string, fallback: T): T {
  const all = readAll();
  return (all[fieldId] as T | undefined) ?? fallback;
}

export function getAllResponses(): ResponsesMap {
  return readAll();
}

export function clearAllResponses() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Puxa as respostas salvas no servidor pra um clientId e funde no localStorage.
 *
 * Usado ao entrar de outro aparelho (/entrar) e ao abrir o painel — assim o
 * cliente, ou um sócio convidado, continua de onde parou. Edições locais
 * (autosave recente ainda não confirmado) vencem em caso de conflito.
 */
export async function pullResponsesFromServer(clientId: string): Promise<void> {
  if (typeof window === "undefined" || !clientId) return;
  try {
    const res = await fetch("/api/briefing/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { responses?: ResponsesMap };
    if (!data.responses) return;
    const local = readAll();
    writeAll({ ...data.responses, ...local });
  } catch {
    // offline / modo demo — mantém o localStorage como está.
  }
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Hook de campo com autosave debounced.
 * Em modo demo grava em localStorage; quando Supabase Auth estiver ativo,
 * dispara também POST para /api/briefing/save.
 */
export function useBriefingField<T>(
  blocoId: string,
  fieldId: string,
  defaultValue: T
) {
  const fullKey = `${blocoId}.${fieldId}`;
  const [value, setValue] = useState<T>(() =>
    getResponse(fullKey, defaultValue)
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: T) => {
      const all = readAll();
      all[fullKey] = next as ResponseValue;
      writeAll(all);

      // Envio remoto identificado pelo clientId (o cliente já tem em
      // localStorage, vindo de /api/auth/start ou /api/auth/login). Sem
      // clientId só dá pra guardar local — modo demo.
      const clientId = loadCliente()?.id;
      if (clientId) {
        void fetch("/api/briefing/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, blocoId, fieldId, value: next }),
        })
          // 4xx/5xx não é fatal — o localStorage já guardou a resposta.
          .then(() => setStatus("saved"))
          .catch(() => setStatus("saved")); // offline/demo: localStorage já salvou
      }

      // localStorage já garantiu a persistência local.
      setStatus("saved");
    },
    [blocoId, fieldId, fullKey]
  );

  const update = useCallback(
    (next: T) => {
      setValue(next);
      setStatus("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => persist(next), 600);
    },
    [persist]
  );

  // Limpa timer ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [value, update, status] as const;
}

/**
 * Computa progresso de blocos preenchidos vs. esperados.
 * Hoje implementação simples: bloco está "iniciado" se há ao menos 1 resposta
 * e "concluído" quando todos os campos required estão preenchidos.
 *
 * O cálculo "completo" será feito server-side em M3. Por ora retorna start/total.
 */
export function getBlockProgress(blocoId: string, expectedFields: string[]) {
  const all = readAll();
  const filled = expectedFields.filter((f) => {
    const value = all[`${blocoId}.${f}`];
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return Boolean(value);
  });
  return { filled: filled.length, total: expectedFields.length };
}
