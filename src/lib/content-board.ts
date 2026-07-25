/**
 * Quadro de produção de conteúdo (kanban) — tipos client-safe.
 * A função que lê o banco (service-role) fica em `content-board-server.ts`.
 */

export interface ContentCard {
  id: string;
  column_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
}

export interface ContentColumn {
  id: string;
  titulo: string;
  ordem: number;
  cards: ContentCard[];
}

/** Colunas de exemplo pra semear um quadro novo (pipeline de conteúdo). */
export const DEFAULT_CONTENT_COLUMNS = [
  "Ideias",
  "Em produção",
  "Em revisão",
  "Aprovado",
  "Publicado",
];
