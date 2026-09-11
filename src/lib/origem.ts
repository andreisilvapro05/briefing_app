/**
 * De onde o cliente conheceu a Fysi.
 *
 * Opções fixas (não texto livre) de propósito: escolher é um toque, digitar
 * é fricção — e sem padronizar não dá pra somar quantos vieram de cada canal
 * depois. Cada uma tem cor própria pra virar seleção visual em vez de um
 * <select> cinza.
 *
 * Sem opção "Outro" por decisão da Karine: "Outro" não informa nada e vira
 * o atalho de quem não quer pensar. A lista cobre os canais reais da
 * agência; se aparecer um caminho novo e recorrente, entra aqui.
 */
export interface OrigemOpcao {
  value: string;
  label: string;
  emoji: string;
  /** Classes do card quando selecionado. */
  ativo: string;
  /** Cor do respingo quando não selecionado. */
  ponto: string;
}

export const ORIGENS: OrigemOpcao[] = [
  {
    value: "indicacao",
    label: "Indicação",
    emoji: "🤝",
    ativo: "bg-emerald-50 border-emerald-400 text-emerald-800",
    ponto: "bg-emerald-400",
  },
  {
    value: "amigo",
    label: "Amigo ou conhecido",
    emoji: "👋",
    ativo: "bg-teal-50 border-teal-400 text-teal-800",
    ponto: "bg-teal-400",
  },
  {
    value: "instagram",
    label: "Instagram",
    emoji: "📸",
    ativo: "bg-pink-50 border-pink-400 text-pink-800",
    ponto: "bg-pink-400",
  },
  {
    value: "tiktok",
    label: "TikTok",
    emoji: "🎵",
    ativo: "bg-slate-100 border-slate-500 text-slate-900",
    ponto: "bg-slate-500",
  },
  {
    value: "youtube",
    label: "YouTube",
    emoji: "▶️",
    ativo: "bg-red-50 border-red-400 text-red-800",
    ponto: "bg-red-400",
  },
  {
    value: "pinterest",
    label: "Pinterest",
    emoji: "📌",
    ativo: "bg-rose-50 border-rose-400 text-rose-800",
    ponto: "bg-rose-400",
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    emoji: "💼",
    ativo: "bg-sky-50 border-sky-400 text-sky-800",
    ponto: "bg-sky-400",
  },
  {
    value: "behance",
    label: "Behance",
    emoji: "🎨",
    ativo: "bg-blue-50 border-blue-500 text-blue-800",
    ponto: "bg-blue-500",
  },
  {
    value: "google",
    label: "Pesquisa no Google",
    emoji: "🔍",
    ativo: "bg-amber-50 border-amber-400 text-amber-800",
    ponto: "bg-amber-400",
  },
  {
    value: "anuncios",
    label: "Anúncios",
    emoji: "📣",
    ativo: "bg-orange-50 border-orange-400 text-orange-800",
    ponto: "bg-orange-400",
  },
  {
    value: "curso",
    label: "Curso",
    emoji: "🎓",
    ativo: "bg-violet-50 border-violet-400 text-violet-800",
    ponto: "bg-violet-400",
  },
  {
    value: "site",
    label: "Site da Fysi",
    emoji: "🌐",
    ativo: "bg-fysi-mint/40 border-fysi-mint-vivid text-fysi-deep",
    ponto: "bg-fysi-mint-vivid",
  },
  {
    value: "ja-era-cliente",
    label: "Já era cliente",
    emoji: "⭐",
    ativo: "bg-yellow-50 border-yellow-400 text-yellow-800",
    ponto: "bg-yellow-400",
  },
];

export const ORIGEM_LABEL: Record<string, string> = Object.fromEntries(
  ORIGENS.map((o) => [o.value, o.label])
);
export const ORIGEM_EMOJI: Record<string, string> = Object.fromEntries(
  ORIGENS.map((o) => [o.value, o.emoji])
);
export const ORIGEM_VALUES: string[] = ORIGENS.map((o) => o.value);

export function origemOpcao(valor: string | null | undefined) {
  if (!valor) return null;
  return ORIGENS.find((o) => o.value === valor) ?? null;
}

/** Rótulo pra exibir — aceita valor antigo/livre que não esteja mais na lista. */
export function origemLabel(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return ORIGEM_LABEL[valor] ?? valor;
}
