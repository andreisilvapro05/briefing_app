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
export type EIDocumentKind = "ei" | "briefing" | "nota";

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
  /**
   * true = material histórico importado do ClickUp (ex-cliente ou versão
   * antiga do mesmo projeto). A barra lateral separa "ativos" de "arquivo":
   * com centenas de Estruturas Iniciais numa lista só, achar a do cliente
   * de amanhã ficaria pior do que era antes de importar.
   */
  arquivado: boolean;
  /** Data da página no ClickUp — distingue as várias EIs do mesmo cliente. */
  referenciaEm: string | null;
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
 * Título exibido, em ordem de precedência:
 *   1. o NOME escrito à mão (quando existe);
 *   2. "Modelo", pro documento-modelo;
 *   3. empresa/nome do cliente, derivado ao vivo.
 *
 * ⚠️ O nome à mão vinha ANTES de tudo e era IGNORADO quando havia cliente:
 * `if (doc.client) return doc.client.empresa` vinha primeiro. Na prática,
 * todos os briefings do mesmo cliente apareciam na lista com o MESMO
 * título — e vários clientes têm dois ou três (projetos diferentes, meses
 * diferentes). Era impossível saber qual era qual sem abrir um por um.
 * Karine (04/10): "está bagunçado".
 *
 * O cliente continua sendo o padrão: quem não nomeia nada segue vendo o
 * nome dele, atualizado ao vivo se a ficha for renomeada.
 */
export function eiDocumentTitle(doc: {
  isTemplate: boolean;
  nome: string | null;
  /**
   * Só nome e empresa: pedir `EIDocumentClientInfo` inteiro obrigava quem
   * chama a inventar `fysiDriveLink`/`clienteDriveLink` que a função nem
   * olha — e inventar campo pra satisfazer tipo é como se escreve um bug.
   */
  client: { nome: string | null; empresa: string | null } | null;
}): string {
  const proprio = doc.nome?.trim();
  if (proprio) return proprio;
  if (doc.isTemplate) return "Modelo";
  if (doc.client) return doc.client.empresa || doc.client.nome || "Sem título";
  return "Sem título";
}

/** Nome da cópia: "Briefing" → "Briefing (cópia)" → "Briefing (cópia 2)". */
export function nomeDaCopia(titulo: string, jaExistentes: string[]): string {
  const base = titulo.replace(/\s*\(cópia(?: \d+)?\)\s*$/i, "").trim();
  const usados = new Set(jaExistentes.map((n) => n.trim().toLowerCase()));
  const primeiro = `${base} (cópia)`;
  if (!usados.has(primeiro.toLowerCase())) return primeiro;
  for (let i = 2; i < 100; i++) {
    const tentativa = `${base} (cópia ${i})`;
    if (!usados.has(tentativa.toLowerCase())) return tentativa;
  }
  return `${base} (cópia ${Date.now()})`;
}
