/**
 * Metadados visuais por tipo de notificação (emoji, label, cores) —
 * compartilhado entre o banner de /admin e o sino no topbar, pra não
 * duplicar/desalinhar estilo entre os dois lugares que mostram avisos.
 */
export const NOTIFICATION_KIND_META: Record<
  string,
  { emoji: string; label: string; dot: string; ring: string }
> = {
  "contrato.preenchido": {
    emoji: "🚀",
    label: "Elevou o nível",
    dot: "bg-fysi-yellow",
    ring: "bg-fysi-yellow/25",
  },
  "briefing.concluido": {
    emoji: "✅",
    label: "Briefing concluído",
    dot: "bg-fysi-mint-vivid",
    ring: "bg-fysi-mint/40",
  },
  "pagamento.recebido": {
    emoji: "💰",
    label: "Pagamento recebido",
    dot: "bg-fysi-mint-vivid",
    ring: "bg-fysi-mint/40",
  },
  "projeto.novo": {
    emoji: "📸",
    label: "Novo projeto — postar nos Stories",
    dot: "bg-fysi-yellow",
    ring: "bg-fysi-yellow/25",
  },
  outro: {
    emoji: "🔔",
    label: "Aviso",
    dot: "bg-fysi-line-strong",
    ring: "bg-fysi-cream",
  },
};
