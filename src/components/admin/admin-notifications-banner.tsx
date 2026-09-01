"use client";

import { useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  dismissAllNotificationsAction,
  dismissNotificationAction,
} from "@/app/admin/actions";
import { NOTIFICATION_KIND_META } from "@/lib/notification-meta";

export interface AdminNotification {
  id: string;
  client_id: string | null;
  kind: string;
  title: string;
  message: string | null;
  created_at: string;
}

const KIND_META = NOTIFICATION_KIND_META;

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

  function dismissAll() {
    const fd = new FormData();
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await dismissAllNotificationsAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="mb-6 overflow-hidden rounded-[16px] border border-fysi-line bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-fysi-line bg-fysi-cream/60 px-4 py-3">
        <span className="text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-fysi-deep">
          Avisos
        </span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fysi-deep px-1.5 text-[0.7rem] font-semibold leading-none text-fysi-cream">
          {notifications.length}
        </span>
        <button
          type="button"
          onClick={dismissAll}
          disabled={pending}
          className="ml-auto text-xs font-medium text-fysi-muted hover:text-fysi-deep disabled:opacity-40"
        >
          Limpar todos
        </button>
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
                className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-4 transition-colors hover:bg-fysi-cream/50"
              >
                <span
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.ring}`}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {meta.emoji}
                  </span>
                  <span
                    className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white ${meta.dot}`}
                    aria-hidden
                  />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-fysi-muted">
                    {meta.label}
                  </span>
                  <span className="truncate text-base font-semibold text-fysi-deep">
                    {sanitizeForBanner(n.title)}
                  </span>
                  {n.message && !looksLikePII(n.message) ? (
                    <span className="truncate text-sm font-normal text-fysi-muted">
                      {n.message}
                    </span>
                  ) : null}
                </span>

                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-fysi-muted">
                  {when}
                </span>
              </Link>

              <button
                type="button"
                onClick={(e) => dismiss(e, n.id)}
                disabled={pending}
                className="mr-2.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-fysi-muted transition-colors hover:bg-fysi-cream hover:text-fysi-deep disabled:opacity-40"
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
