"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  dismissAllNotificationsAction,
  dismissNotificationAction,
  getUnreadAdminNotificationsAction,
  type AdminNotificationRow,
} from "@/app/admin/actions";
import { NOTIFICATION_KIND_META } from "@/lib/notification-meta";

/**
 * Sino de notificações no topbar — visível em toda página admin (antes só
 * existia como banner na tela de Clientes). Busca no cliente (não é
 * server-rendered) pra pegar avisos novos sem precisar de F5, reaproveitando
 * o padrão de re-sync por foco/visibilidade já usado em /dashboard.
 */
export function NotificationsBell({
  keyParam,
  urlKey,
}: {
  keyParam: string;
  urlKey?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>(
    []
  );
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  function refetch() {
    void getUnreadAdminNotificationsAction(urlKey ?? null).then(setNotifications);
  }

  useEffect(() => {
    refetch();
    function onVisible() {
      if (document.visibilityState === "hidden") return;
      refetch();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onEsc);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function go(href: string) {
    setOpen(false);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function dismiss(id: string) {
    const fd = new FormData();
    fd.append("notificationId", id);
    if (urlKey) fd.append("key", urlKey);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    startTransition(async () => {
      await dismissNotificationAction(fd);
    });
  }

  function dismissAll() {
    const fd = new FormData();
    if (urlKey) fd.append("key", urlKey);
    setNotifications([]);
    startTransition(async () => {
      await dismissAllNotificationsAction(fd);
    });
  }

  const count = notifications.length;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-fysi-line bg-white text-fysi-muted hover:border-fysi-deep/30 hover:text-fysi-deep transition"
        aria-label={count > 0 ? `Notificações (${count} não lidas)` : "Notificações"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.62rem] font-semibold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[22rem] max-w-[90vw] overflow-hidden rounded-[16px] border border-fysi-line bg-white shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-fysi-line bg-fysi-cream/60 px-4 py-3">
            <span className="text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-fysi-deep">
              Avisos
            </span>
            {count > 0 ? (
              <button
                type="button"
                onClick={dismissAll}
                disabled={pending}
                className="ml-auto text-xs font-medium text-fysi-muted hover:text-fysi-deep disabled:opacity-40"
              >
                Limpar todos
              </button>
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {count === 0 ? (
              <p className="text-sm text-fysi-muted text-center py-8">
                Nenhum aviso novo.
              </p>
            ) : (
              <ul className="divide-y divide-fysi-line">
                {notifications.map((n) => {
                  const meta =
                    NOTIFICATION_KIND_META[n.kind] ??
                    NOTIFICATION_KIND_META.outro;
                  const href = n.client_id
                    ? `/admin/${n.client_id}${keyParam}`
                    : `/admin${keyParam}`;
                  return (
                    <li key={n.id} className="group/row flex items-center">
                      <button
                        type="button"
                        onClick={() => go(href)}
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fysi-cream/50"
                      >
                        <span
                          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.ring}`}
                        >
                          <span className="text-base leading-none" aria-hidden>
                            {meta.emoji}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-fysi-muted">
                            {meta.label}
                          </span>
                          <span className="truncate text-sm font-semibold text-fysi-deep">
                            {n.title}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => dismiss(n.id)}
                        disabled={pending}
                        className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm text-fysi-muted transition-colors hover:bg-fysi-cream hover:text-fysi-deep disabled:opacity-40"
                        title="Dispensar aviso"
                        aria-label="Dispensar aviso"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
