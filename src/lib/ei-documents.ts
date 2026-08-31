import type { PartialBlock } from "@blocknote/core";

/**
 * Um documento do hub de Estruturas Iniciais: ou é o Modelo
 * (isTemplate = true, clientId = null), ou é a EI de um cliente
 * (clientId setado). Ver docs/superpowers/specs/
 * 2026-08-30-estruturas-iniciais-hub-design.md e
 * 2026-08-30-ei-documento-blocos-design.md
 *
 * A mesma tabela (ei_documents) guarda dois "tipos" de documento (`kind`):
 * "ei" (Estrutura Inicial) e "briefing" (documento de briefing preenchido
 * com o cliente durante a call, no estilo ClickUp/Notion — pedido do
 * usuário em 2026-08-31, ver https://app.clickup.com/31006509/docs/xj7td-41071).
 * Cada kind tem no máximo 1 Modelo e no máximo 1 documento por cliente
 * (unique index em (client_id, kind) e em (kind) where is_template).
 */
export type EIDocumentKind = "ei" | "briefing";

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
  kind: EIDocumentKind;
  updatedAt: string;
}

/** Documento completo — usado no painel do hub e no editor de blocos. */
export interface EIDocument {
  id: string;
  clientId: string | null;
  isTemplate: boolean;
  kind: EIDocumentKind;
  nome: string | null;
  blocks: PartialBlock[];
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
