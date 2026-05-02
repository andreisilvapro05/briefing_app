"use client";

import type { Cliente, ProjectType } from "./types";

/**
 * Adapter de persistência local.
 *
 * Em M2 isso será substituído por chamadas Supabase + magic link.
 * A interface pública (loadCliente / saveCliente / setProjectType) é
 * estável e deve continuar igual quando trocarmos a implementação.
 */

const KEY = "fysi.cliente.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadCliente(): Cliente | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Cliente;
  } catch {
    return null;
  }
}

export function saveCliente(
  partial: Omit<Cliente, "id" | "createdAt" | "updatedAt">
): Cliente {
  const existing = loadCliente();
  const now = new Date().toISOString();
  const cliente: Cliente = existing
    ? { ...existing, ...partial, updatedAt: now }
    : {
        ...partial,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
  window.localStorage.setItem(KEY, JSON.stringify(cliente));
  return cliente;
}

export function setProjectType(projectType: ProjectType): Cliente | null {
  const existing = loadCliente();
  if (!existing) return null;
  const updated: Cliente = {
    ...existing,
    projectType,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}


/**
 * Substitui o id local do cliente pelo id do servidor (Supabase) após
 * o /api/auth/start retornar. Mantém o resto dos dados intactos.
 */
export function setClientId(serverId: string): Cliente | null {
  const existing = loadCliente();
  if (!existing) return null;
  if (existing.id === serverId) return existing;
  const updated: Cliente = {
    ...existing,
    id: serverId,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export function clearCliente() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY);
}
