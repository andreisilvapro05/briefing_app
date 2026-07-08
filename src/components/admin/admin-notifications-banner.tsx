"use client";

import { useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dismissNotificationAction } from "@/app/admin/actions";

export interface AdminNotification {
  id: string;
  client_id: string | null;
  kind: string;
  title: string;
  message: string | null;
  created_at: string;
}

// Cada tipo carrega só um ícone discreto + a cor do dot sinalizador.
// Nada de fundo colorido gritante — o aviso é uma linha, não um cartaz.
const KIND_META: Record<string, { emoji: string; label: string; dot: string }> = {
  "contrato.preenchido": {
    emoji: "🚀",
    label: "Elevou o nível",
    dot: "bg-fysi-yellow",
  },
  "briefing.concluido": {
    emoji: "✅",
    label: "Briefing concluído",
    dot: "bg-fysi-mint-vivid",
  },
  "pagamento.recebido": {
    emoji: "💰",
    label: "Pagamento recebido",
    dot: "bg-fysi-mint-vivid",
  },
  outro: {
    emoji: "🔔",
    label: "Aviso",
    dot: "bg-fysi-line-strong",
  },
};

/**
 * Banner de avisos pra admin — mostra notificações não lidas no topo de
 * /admin como uma LISTA densa e discreta. Cada aviso é uma linha (dot + ícone
 * + título + tempo + fechar). Click vai pro cliente; ✕ dispensa (marca lida).
 */
export function AdminNotificationsBanner({
  notifications,
  urlKey,
}: {
  notifications: AdminNotification[];
  urlKey: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  if (notifications.length === 0) return null;

  function dismiss(e: MouseEvent<HTMLButtonElement>, id: string) {
    // Stop event bubble pro Link em volta — botão ✕ não deve navegar.
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData();
    fd.append("notificationId", id);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await dismissNotificationAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="mb-6 overflow-hidden rounded-[12px] border border-fysi-line bg-white">
      <div className="flex items-center gap-2 border-b border-fysi-line bg-fysi-cream/60 px-3 py-1.5">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-fysi-muted">
          Avisos
        </span>
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fysi-deep px-1 text-[0.6rem] font-semibold leading-none text-fysi-cream">
          {notifications.length}
        </span>
      </div>

      <ul className="divide-y divide-fysi-line">
        {notifications.map((n) => {
          const meta = KIND_META[n.kind] ?? KIND_META.outro;
          const minutes = Math.max(
            1,
            Math.floor((Date.now() - new Date(n.created_at).getTime()) / 60_000)
          );
          const when =
            minutes < 60
              ? `${minutes} min`
              : minutes < 60 * 24
                ? `${Math.floor(minutes / 60)}h`
                : `${Math.floor(minutes / 1440)}d`;

          const href = n.client_id
            ? `/admin/${n.client_id}${keyParam}`
            : `/admin${keyParam}`;

          return (
            <li key={n.id} className="group/row flex items-center">
              <Link
                href={href}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 transition-colors hover:bg-fysi-cream/50"
              >
                <span className="relative flex shrink-0">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                    aria-hidden
                  />
                </span>

                <span className="shrink-0 text-sm leading-none" aria-hidden>
                  {meta.emoji}
                </span>

                <span className="min-w-0 flex-1 truncate text-[0.8rem] font-medium text-fysi-deep">
                  <span className="text-fysi-muted">{meta.label}</span>
                  <span className="mx-1.5 text-fysi-line-strong">·</span>
                  {sanitizeForBanner(n.title)}
                  {n.message && !looksLikePII(n.message) ? (
                    <span className="ml-1.5 font-normal text-fysi-muted">
                      {n.message}
                    </span>
                  ) : null}
                </span>

                <span className="shrink-0 whitespace-nowrap text-[0.65rem] tabular-nums text-fysi-muted">
                  {when}
                </span>
              </Link>

              <button
                type="button"
                onClick={(e) => dismiss(e, n.id)}
                disabled={pending}
                className="mr-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs text-fysi-muted transition-colors hover:bg-fysi-cream hover:text-fysi-deep disabled:opacity-40"
                title="Dispensar aviso"
                aria-label="Dispensar aviso"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sanitização defensiva — banner é visível em ambientes públicos (cafés,
// reuniões com cliente). Se o título carrega nome COMPLETO (3+ palavras),
// reduz pra primeiro nome. Se a mensagem cheira a PII (CPF, email, telefone),
// não mostra.

function sanitizeForBanner(title: string): string {
  // Pega palavras antes do "preencheu" ou primeira palavra+verbo
  const m = title.match(/^(.+?)\s+(preencheu|enviou|concluiu|pagou)\s+(.+)$/i);
  if (!m) return title;
  const sujeito = m[1].trim();
  const verbo = m[2];
  const resto = m[3];
  // Se sujeito tem 3+ palavras, é nome completo — reduz pro primeiro nome.
  const words = sujeito.split(/\s+/);
  if (words.length >= 3) {
    return `${words[0]} ${verbo} ${resto}`;
  }
  return title;
}

const PII_PATTERNS = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/, // CNPJ
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // email
  /\(?\d{2}\)?\s?9?\d{4}-?\d{4}/, // telefone BR
  /\b\d{5}-?\d{3}\b/, // CEP
];

function looksLikePII(text: string): boolean {
  return PII_PATTERNS.some((re) => re.test(text));
}
