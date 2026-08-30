import type { EIData } from "./ei-template";

/**
 * Um documento do hub de Estruturas Iniciais: ou é o Modelo
 * (isTemplate = true, clientId = null), ou é a EI de um cliente
 * (clientId setado). Ver docs/superpowers/specs/
 * 2026-08-30-estruturas-iniciais-hub-design.md
 */

export interface EIDocumentClientInfo {
  id: string;
  nome: string | null;
  empresa: string | null;
  /** Drive da Fysi ou do cliente, usado como fallback quando a EI ainda não tem link próprio (ver EIDocument). */
  fysiDriveLink: string | null;
  clienteDriveLink: string | null;
}

/** Linha resumida — usada na sidebar do hub (lista de documentos). */
export interface EIDocumentSummary {
  id: string;
  title: string;
  isTemplate: boolean;
  clientId: string | null;
  updatedAt: string;
}

/** Documento completo — usado no painel do hub e no editor. */
export interface EIDocument {
  id: string;
  clientId: string | null;
  isTemplate: boolean;
  nome: string | null;
  eiData: EIData;
  createdAt: string;
  updatedAt: string;
  client: EIDocumentClientInfo | null;
}

/**
 * Título exibido: "Modelo" pro documento-modelo, empresa/nome do cliente
 * pros demais (derivado ao vivo do cliente — evita título desatualizado
 * se o cliente for renomeado depois).
 */
export function eiDocumentTitle(doc: {
  isTemplate: boolean;
  nome: string | null;
  client: EIDocumentClientInfo | null;
}): string {
  if (doc.isTemplate) return "Modelo";
  if (doc.client) return doc.client.empresa || doc.client.nome || "Sem título";
  return doc.nome || "Sem título";
}
