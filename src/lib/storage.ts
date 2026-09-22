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

/**
 * Grava no localStorage sem deixar a exceção subir.
 *
 * Navegador com dados de site bloqueados — aba anônima, cookies negados,
 * cota estourada — faz o próprio `setItem` lançar. Sem esta guarda, o
 * cliente que abre o link num navegador assim não conseguia passar do
 * primeiro passo do onboarding: a tela quebrava, e não havia como saber
 * por quê.
 *
 * Devolve `false` quando não deu, pra quem chama poder avisar. O dado vale
 * só enquanto a aba estiver aberta — o que é pior do que guardar, mas é
 * muito melhor do que travar.
 */
function gravarLocal(chave: string, valor: string): boolean {
  try {
    window.localStorage.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

export function loadCliente(): Cliente | null {
  if (!isBrowser()) return null;
  try {
    // O `getItem` estava FORA do try. Não era só zelo: esta função virou o
    // getSnapshot de um useSyncExternalStore (src/app/_hooks/dados-locais.ts),
    // e getSnapshot roda a cada render. Navegador com dados de site
    // bloqueados — aba anônima, cookies negados — faz o próprio `getItem`
    // lançar, e aí a tela do CLIENTE quebrava inteira em vez de se comportar
    // como quem não tem nada guardado.
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
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
  gravarLocal(KEY, JSON.stringify(cliente));
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
  gravarLocal(KEY, JSON.stringify(updated));
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
  gravarLocal(KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Grava um cliente completo vindo do servidor (login por telefone + código,
 * via /api/auth/login). Substitui qualquer cliente local. Usado pela /entrar.
 */
export function hydrateCliente(data: {
  id: string;
  nome: string;
  whatsapp: string;
  email?: string;
  empresa?: string;
  projectType?: ProjectType;
}): Cliente {
  const now = new Date().toISOString();
  const cliente: Cliente = {
    id: data.id,
    nome: data.nome,
    whatsapp: data.whatsapp,
    email: data.email,
    empresa: data.empresa,
    projectType: data.projectType,
    createdAt: now,
    updatedAt: now,
  };
  if (isBrowser()) gravarLocal(KEY, JSON.stringify(cliente));
  return cliente;
}

export function clearCliente() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* mesma história do gravarLocal. */
  }
}
