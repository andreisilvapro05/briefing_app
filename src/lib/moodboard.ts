/**
 * Moodboard — quadro estilo Padlet pra cliente aprovar/comentar
 * referências visuais antes da equipe entrar na produção.
 */

export type MoodboardItemTipo = "imagem" | "link" | "nota" | "cor";

export interface MoodboardComentario {
  id: string;
  autor: "admin" | "cliente";
  texto: string;
  criado_em: string; // ISO
}

export interface MoodboardItem {
  id: string;
  tipo: MoodboardItemTipo;
  /** Título curto (opcional). */
  titulo: string;
  /**
   * Conteúdo principal — semântica depende do tipo:
   *   - imagem: URL da imagem
   *   - link: URL do site/Behance/Dribbble
   *   - nota: texto livre
   *   - cor: hex (#FF0044)
   */
  conteudo: string;
  /** Notas/explicação do admin sobre por que esse item está aqui. */
  notas: string;
  /** Reação do cliente. */
  status: "pendente" | "aprovado" | "rejeitado";
  comentarios: MoodboardComentario[];
  criado_em: string;
}

export type MoodboardStatus =
  | "rascunho"
  | "enviado"
  | "em_revisao"
  | "aprovado";

export interface Moodboard {
  titulo: string;
  descricao: string;
  items: MoodboardItem[];
  status: MoodboardStatus;
  enviado_em: string | null;
}

export function emptyMoodboard(): Moodboard {
  return {
    titulo: "Moodboard inicial",
    descricao:
      "Junta aqui as referências de cor, tipografia, mood e layout pra alinhamento antes do design.",
    items: [],
    status: "rascunho",
    enviado_em: null,
  };
}

export function emptyItem(tipo: MoodboardItemTipo): MoodboardItem {
  return {
    id: cryptoRandomId(),
    tipo,
    titulo: "",
    conteudo: tipo === "cor" ? "#042B30" : "",
    notas: "",
    status: "pendente",
    comentarios: [],
    criado_em: new Date().toISOString(),
  };
}

export function emptyComentario(
  autor: "admin" | "cliente",
  texto: string
): MoodboardComentario {
  return {
    id: cryptoRandomId(),
    autor,
    texto,
    criado_em: new Date().toISOString(),
  };
}

function cryptoRandomId(): string {
  // crypto.randomUUID está disponível em Node 19+ e browsers modernos
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback simples
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function statusLabel(s: MoodboardStatus): string {
  return (
    {
      rascunho: "Rascunho",
      enviado: "Enviado ao cliente",
      em_revisao: "Em revisão",
      aprovado: "Aprovado",
    } as const
  )[s];
}

export function itemStatusEmoji(s: MoodboardItem["status"]): string {
  return s === "aprovado" ? "✓" : s === "rejeitado" ? "✕" : "○";
}

/**
 * Stats agregadas pra UI (badges, banners).
 */
export function moodboardStats(m: Moodboard): {
  total: number;
  aprovados: number;
  rejeitados: number;
  pendentes: number;
  comentarios: number;
} {
  let aprovados = 0,
    rejeitados = 0,
    pendentes = 0,
    comentarios = 0;
  m.items.forEach((i) => {
    if (i.status === "aprovado") aprovados++;
    else if (i.status === "rejeitado") rejeitados++;
    else pendentes++;
    comentarios += i.comentarios.length;
  });
  return { total: m.items.length, aprovados, rejeitados, pendentes, comentarios };
}
