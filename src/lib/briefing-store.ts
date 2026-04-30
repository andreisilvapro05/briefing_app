"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

      // Tentativa de envio remoto. Se estiver em modo demo, ignora silenciosamente.
      void fetch("/api/briefing/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocoId, fieldId, value: next }),
      })
        .then((res) => {
          if (res.ok) setStatus("saved");
          else if (res.status === 401)
            setStatus("saved"); // demo mode: sem auth, mas localStorage OK
          else setStatus("error");
        })
        .catch(() => setStatus("saved")); // offline/demo: localStorage já salvou

      // Em modo demo, marcar como saved imediatamente
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
