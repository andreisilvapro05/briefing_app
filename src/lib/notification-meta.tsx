import type { ReactNode } from "react";

/**
 * Aparência por tipo de aviso — compartilhado entre o banner de /admin e o
 * sino do topbar, pra não desalinhar os dois lugares que mostram avisos.
 *
 * Eram emojis (🚀 ✅ 💰 🔔). Viraram ícones SVG: emoji renderiza diferente
 * por sistema e deixa cara de protótipo numa ferramenta de trabalho.
 */

function I({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export interface NotificationMeta {
  icon: ReactNode;
  label: string;
  /** Cor do ponto na lista compacta. */
  dot: string;
  /** Fundo do círculo do ícone. */
  ring: string;
  /** Cor do traço do ícone. */
  tint: string;
}

export const NOTIFICATION_KIND_META: Record<string, NotificationMeta> = {
  "contrato.preenchido": {
    icon: (
      <I>
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M9 14l2 2 4-4" />
      </I>
    ),
    label: "Contrato preenchido",
    dot: "bg-fysi-yellow",
    ring: "bg-fysi-yellow/25",
    tint: "text-fysi-deep",
  },
  "briefing.concluido": {
    icon: (
      <I>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M9 13l2 2 4-4" />
      </I>
    ),
    label: "Briefing concluído",
    dot: "bg-fysi-mint-vivid",
    ring: "bg-fysi-mint/40",
    tint: "text-fysi-deep",
  },
  "pagamento.recebido": {
    icon: (
      <I>
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19" />
      </I>
    ),
    label: "Pagamento recebido",
    dot: "bg-fysi-mint-vivid",
    ring: "bg-fysi-mint/40",
    tint: "text-fysi-deep",
  },
  "projeto.novo": {
    icon: (
      <I>
        <path d="M12 5v14M5 12h14" />
      </I>
    ),
    label: "Projeto novo",
    dot: "bg-fysi-yellow",
    ring: "bg-fysi-yellow/25",
    tint: "text-fysi-deep",
  },
  // --- caixa de entrada da pessoa (member_notifications) ---
  "tarefa.atribuida": {
    icon: (
      <I>
        <circle cx="10" cy="8" r="3.5" />
        <path d="M3 20c0-3.6 3.1-6.5 7-6.5M17 11v6M14 14h6" />
      </I>
    ),
    label: "Demanda pra você",
    dot: "bg-fysi-mint-vivid",
    ring: "bg-fysi-mint/40",
    tint: "text-fysi-deep",
  },
  "tarefa.comentario": {
    icon: (
      <I>
        <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" />
      </I>
    ),
    label: "Comentário",
    dot: "bg-fysi-yellow",
    ring: "bg-fysi-yellow/25",
    tint: "text-fysi-deep",
  },
  "tarefa.status": {
    icon: (
      <I>
        <path d="M21 12a9 9 0 1 1-3.5-7.1" />
        <path d="M21 4v5h-5" />
      </I>
    ),
    label: "Status mudou",
    dot: "bg-fysi-line-strong",
    ring: "bg-fysi-cream",
    tint: "text-fysi-deep",
  },
  "tarefa.prazo": {
    icon: (
      <I>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18M12 14v3" />
      </I>
    ),
    label: "Prazo mudou",
    dot: "bg-fysi-yellow",
    ring: "bg-fysi-yellow/25",
    tint: "text-fysi-deep",
  },
  "tarefa.clickup": {
    icon: (
      <I>
        <path d="M12 3l9 5-9 5-9-5 9-5zM3 16l9 5 9-5" />
      </I>
    ),
    label: "Veio do ClickUp",
    dot: "bg-fysi-line-strong",
    ring: "bg-fysi-cream",
    tint: "text-fysi-deep",
  },
  outro: {
    icon: (
      <I>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </I>
    ),
    label: "Aviso",
    dot: "bg-fysi-line-strong",
    ring: "bg-fysi-cream",
    tint: "text-fysi-muted",
  },
};

export function metaDoAviso(kind: string): NotificationMeta {
  return NOTIFICATION_KIND_META[kind] ?? NOTIFICATION_KIND_META.outro;
}

/**
 * "21/09 14:32" no fuso de Brasília.
 *
 * Era "há 12 min", calculado com `Date.now()` durante o render — impuro: o
 * servidor renderiza um número, o cliente outro, e o HTML não bate na
 * hidratação (mesma classe do erro #418 que este app já teve). Data fixa é
 * determinística e ainda diz o dia, que o relativo escondia.
 */
export function quandoChegou(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "";
  }
}
