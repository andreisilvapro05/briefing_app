/**
 * Categorização de anexos do briefing.
 *
 * Mapeia field_id (slug do campo de upload no briefing) → categoria humana.
 * Espelha a lógica de `subfolderForField` da lib/google-drive (mas
 * independente — funciona com ou sem integração Drive).
 */

export type FileCategory =
  | "logo"
  | "identidade"
  | "imagens"
  | "depoimentos"
  | "audios"
  | "documentos"
  | "outros";

export interface CategoryDef {
  id: FileCategory;
  label: string;
  emoji: string;
  hint: string;
  // Cor base (mesmas convenções do design system Fysi)
  tone: "yellow" | "mint" | "pink" | "violet" | "amber" | "muted";
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: "logo",
    label: "Logo",
    emoji: "🏷️",
    hint: "Arquivos da logomarca (SVG, PNG, AI)",
    tone: "yellow",
  },
  {
    id: "identidade",
    label: "Identidade visual",
    emoji: "🎨",
    hint: "Manual de marca, paleta, tipografia",
    tone: "violet",
  },
  {
    id: "imagens",
    label: "Imagens e fotos",
    emoji: "📸",
    hint: "Fotos do produto, equipe, ambiente",
    tone: "mint",
  },
  {
    id: "depoimentos",
    label: "Depoimentos",
    emoji: "💬",
    hint: "Prints, vídeos ou textos de clientes",
    tone: "pink",
  },
  {
    id: "audios",
    label: "Áudios",
    emoji: "🎤",
    hint: "Gravações enviadas pelo cliente",
    tone: "amber",
  },
  {
    id: "documentos",
    label: "Documentos",
    emoji: "📄",
    hint: "PDFs, planilhas, textos prontos",
    tone: "muted",
  },
  {
    id: "outros",
    label: "Outros materiais",
    emoji: "📁",
    hint: "Tudo que não bate em outra categoria",
    tone: "muted",
  },
];

export const CATEGORY_BY_ID: Record<FileCategory, CategoryDef> =
  Object.fromEntries(CATEGORY_DEFS.map((c) => [c.id, c])) as Record<
    FileCategory,
    CategoryDef
  >;

/**
 * Classifica um arquivo em categoria a partir do field_id + mime type.
 * field_id ganha prioridade — o nome do campo já carrega intenção.
 */
export function categorizeFile(
  fieldId: string,
  mimeType: string | null
): FileCategory {
  const f = (fieldId ?? "").toLowerCase();
  const m = (mimeType ?? "").toLowerCase();

  if (f.includes("logo")) return "logo";
  if (
    f.includes("identidade") ||
    f.includes("manual") ||
    f.includes("brand") ||
    f.includes("paleta") ||
    f.includes("tipograf")
  ) {
    return "identidade";
  }
  if (f.includes("depoimento") || f.includes("testimonial")) {
    return "depoimentos";
  }
  if (f.includes("foto") || f.includes("imagem") || f.includes("image")) {
    return "imagens";
  }
  if (m.startsWith("audio/") || f.includes("audio") || f.includes("gravaca")) {
    return "audios";
  }
  if (
    m === "application/pdf" ||
    m.includes("officedocument") ||
    m.includes("text/") ||
    f.includes("doc") ||
    f.includes("pdf") ||
    f.includes("texto")
  ) {
    return "documentos";
  }
  // Por mime: imagem ainda solta vai pra imagens
  if (m.startsWith("image/")) return "imagens";

  return "outros";
}

export const CATEGORY_TONE_CLASSES: Record<
  CategoryDef["tone"],
  { bg: string; border: string; text: string; dot: string }
> = {
  yellow: {
    bg: "bg-fysi-yellow/20",
    border: "border-fysi-yellow/60",
    text: "text-fysi-deep",
    dot: "bg-fysi-yellow",
  },
  mint: {
    bg: "bg-fysi-mint",
    border: "border-fysi-mint-vivid/40",
    text: "text-fysi-deep",
    dot: "bg-fysi-mint-vivid",
  },
  pink: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-700",
    dot: "bg-pink-500",
  },
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    dot: "bg-violet-500",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  muted: {
    bg: "bg-fysi-cream/40",
    border: "border-fysi-line",
    text: "text-fysi-deep/70",
    dot: "bg-fysi-muted",
  },
};
