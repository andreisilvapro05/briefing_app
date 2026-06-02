"use client";

import { useTransition } from "react";
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

const KIND_META: Record<string, { emoji: string; label: string; tone: string }> = {
  "contrato.preenchido": {
    emoji: "🚀",
    label: "Elevou o nível",
    tone: "bg-fysi-yellow/40 border-fysi-yellow",
  },
  "briefing.concluido": {
    emoji: "✅",
    label: "Briefing concluído",
    tone: "bg-fysi-mint border-fysi-mint-vivid/40",
  },
  "pagamento.recebido": {
    emoji: "💰",
    label: "Pagamento recebido",
    tone: "bg-fysi-mint border-fysi-mint-vivid/40",
  },
  outro: {
    emoji: "🔔",
    label: "Aviso",
    tone: "bg-fysi-cream border-fysi-line",
  },
};

/**
 * Banner de avisos pra admin — mostra notificações não lidas no topo de
 * /admin. Click vai pro cliente; X dispensa (marca como lida).
 *
 * Animação pulsante discreta no badge pra puxar atenção sem ser intrusivo.
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

  function dismiss(id: string) {
    const fd = new FormData();
    fd.append("notificationId", id);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await dismissNotificationAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 mb-6">
      {notifications.map((n) => {
        const meta = KIND_META[n.kind] ?? KIND_META.outro;
        const minutes = Math.max(
          1,
          Math.floor((Date.now() - new Date(n.created_at).getTime()) / 60_000)
        );
        const when =
          minutes < 60
            ? `${minutes} min atrás`
            : minutes < 60 * 24
              ? `${Math.floor(minutes / 60)}h atrás`
              : `${Math.floor(minutes / 1440)}d atrás`;

        const href = n.client_id
          ? `/admin/${n.client_id}${keyParam}`
          : `/admin${keyParam}`;

        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 border-2 rounded-[14px] ${meta.tone}`}
          >
            <div className="relative">
              <span className="text-xl">{meta.emoji}</span>
              <span className="absolute -top-1 -right-1 inline-flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fysi-deep opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-fysi-deep" />
              </span>
            </div>

            <Link
              href={href}
              className="flex-1 min-w-0 group"
            >
              <div className="text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-fysi-deep/70">
                {meta.label}
              </div>
              <div className="text-sm font-semibold text-fysi-deep mt-0.5 group-hover:underline">
                {n.title}
              </div>
              {n.message ? (
                <div className="text-xs text-fysi-deep/70 mt-0.5">
                  {n.message}
                </div>
              ) : null}
              <div className="text-[0.65rem] text-fysi-muted mt-1">
                {when} · clique pra abrir
              </div>
            </Link>

            <button
              type="button"
              onClick={() => dismiss(n.id)}
              disabled={pending}
              className="text-fysi-muted hover:text-fysi-deep text-sm px-2 py-1 rounded-md hover:bg-white/60 shrink-0"
              title="Dispensar aviso"
              aria-label="Dispensar"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
