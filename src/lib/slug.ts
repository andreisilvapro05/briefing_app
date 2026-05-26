import { randomBytes } from "node:crypto";

/**
 * Slug-ifica um texto livre: minúsculas, sem acentos, hifens, ASCII-safe.
 * Usado pra gerar o magic_slug do cliente a partir da empresa/nome.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Gera o magic_slug: <empresa-ou-nome-slugificado>-<8 chars hex aleatórios>.
 * Os 8 chars dão ~32 bits de entropia — suficiente pra não-adivinhação trivial.
 *
 * Server-only (usa node:crypto).
 */
export function generateMagicSlug(input: {
  nome: string;
  empresa?: string | null;
}): string {
  const base = slugify(input.empresa || input.nome || "cliente") || "cliente";
  const random = randomBytes(4).toString("hex");
  return `${base}-${random}`;
}
