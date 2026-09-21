"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  dismissAllNotificationsAction,
  dismissNotificationAction,
  getUnreadAdminNotificationsAction,
  getMemberNotificationsAction,
  dismissMemberNotificationAction,
  dismissAllMemberNotificationsAction,
  type AdminNotificationRow,
} from "@/app/admin/actions";
import type { MemberNotificationRow } from "@/lib/member-notifications";
import { metaDoAviso, quandoChegou } from "@/lib/notification-meta";

/**
 * Sino do topbar — visível em toda página do admin.
 *
 * Duas caixas, porque são coisas diferentes:
 *  - **Suas demandas** (`member_notifications`): te passaram uma tarefa,
 *    comentaram na sua, mudaram prazo/status. Cada pessoa tem a própria
 *    fila; dispensar não afeta ninguém.
 *  - **Clientes** (`admin_notifications`): briefing concluído, contrato
 *    preenchido, pagamento. É mural do time — dispensar some pra todos.
 *
 * Busca no cliente (não é server-rendered) pra pegar aviso novo sem F5,
 * reaproveitando o re-sync por foco/visibilidade já usado no /dashboard.
 */
export function NotificationsBell({
  keyParam,
  urlKey,
}: {
  keyParam: string;
  urlKey?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [minhas, setMinhas] = useState<MemberNotificationRow[]>([]);
  const [clientes, setClientes] = useState<AdminNotificationRow[]>([]);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const refetch = useCallback(() => {
    void getMemberNotificationsAction(urlKey ?? null).then(setMinhas);
    void getUnreadAdminNotificationsAction(urlKey ?? null).then(setClientes);
  }, [urlKey]);

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
  }, [refetch]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        botaoRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function fd() {
    const f = new FormData();
    if (urlKey) f.append("key", urlKey);
    return f;
  }

  function dispensarMinha(id: string) {
    setMinhas((prev) => prev.filter((n) => n.id !== id));
    const f = fd();
    f.append("notificationId", id);
    startTransition(async () => {
      await dismissMemberNotificationAction(f);
    });
  }

  function dispensarCliente(id: string) {
    setClientes((prev) => prev.filter((n) => n.id !== id));
    const f = fd();
    f.append("notificationId", id);
    startTransition(async () => {
      await dismissNotificationAction(f);
    });
  }

  function limparMinhas() {
    setMinhas([]);
    startTransition(async () => {
      await dismissAllMemberNotificationsAction(fd());
    });
  }

  function limparClientes() {
    setClientes([]);
    startTransition(async () => {
      await dismissAllNotificationsAction(fd());
    });
  }

  const total = minhas.length + clientes.length;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-fysi-line bg-white text-fysi-muted hover:border-fysi-deep/30 hover:text-fysi-deep transition"
        aria-label={
          total > 0 ? `Notificações (${total} não lidas)` : "Notificações"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.62rem] font-semibold leading-none text-white">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 top-11 z-50 w-[23rem] max-w-[92vw] overflow-hidden rounded-[16px] border border-fysi-line bg-white shadow-2xl"
        >
          <div className="max-h-[70vh] overflow-y-auto">
            {total === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-fysi-muted">
                Nada novo por aqui.
              </p>
            ) : null}

            {minhas.length > 0 ? (
              <Secao
                titulo="Suas demandas"
                onLimpar={limparMinhas}
                pending={pending}
              >
                {minhas.map((n) => (
                  <ItemAviso
                    key={n.id}
                    kind={n.kind}
                    title={n.title}
                    message={n.message}
                    createdAt={n.created_at}
                    href={
                      n.client_id && n.task_id
                        ? `/admin/${n.client_id}?tab=tarefas${keyParam ? `&${keyParam.slice(1)}` : ""}#tarefa-${n.task_id}`
                        : `/admin/meu-trabalho${keyParam}`
                    }
                    onDismiss={() => dispensarMinha(n.id)}
                    pending={pending}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </Secao>
            ) : null}

            {clientes.length > 0 ? (
              <Secao
                titulo="Clientes"
                onLimpar={limparClientes}
                pending={pending}
              >
                {clientes.map((n) => (
                  <ItemAviso
                    key={n.id}
                    kind={n.kind}
                    title={n.title}
                    message={n.message}
                    createdAt={n.created_at}
                    href={
                      n.client_id
                        ? `/admin/${n.client_id}${keyParam}`
                        : `/admin${keyParam}`
                    }
                    onDismiss={() => dispensarCliente(n.id)}
                    pending={pending}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </Secao>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Secao({
  titulo,
  onLimpar,
  pending,
  children,
}: {
  titulo: string;
  onLimpar: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-fysi-line bg-fysi-cream/90 px-4 py-2.5 backdrop-blur">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-fysi-deep">
          {titulo}
        </span>
        <button
          type="button"
          onClick={onLimpar}
          disabled={pending}
          className="ml-auto text-xs font-medium text-fysi-muted hover:text-fysi-deep disabled:opacity-40"
        >
          Limpar
        </button>
      </div>
      <ul className="divide-y divide-fysi-line">{children}</ul>
    </section>
  );
}

function ItemAviso({
  kind,
  title,
  message,
  createdAt,
  href,
  onDismiss,
  onNavigate,
  pending,
}: {
  kind: string;
  title: string;
  message: string | null;
  createdAt: string;
  href: string;
  onDismiss: () => void;
  onNavigate: () => void;
  pending: boolean;
}) {
  const meta = metaDoAviso(kind);
  return (
    <li className="group/row flex items-center">
      {/* Link do Next, não window.open: abre na mesma aba e o painel não vira
          um monte de abas ao longo do dia. */}
      <Link
        href={href}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-fysi-cream/50"
      >
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.ring} ${meta.tint}`}
        >
          {meta.icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-fysi-muted">
              {meta.label}
            </span>
            <span className="ml-auto shrink-0 text-[0.68rem] tabular-nums text-fysi-muted">
              {quandoChegou(createdAt)}
            </span>
          </span>
          <span className="truncate text-sm font-semibold text-fysi-deep">
            {title}
          </span>
          {message ? (
            <span className="line-clamp-2 text-xs text-fysi-muted">
              {message}
            </span>
          ) : null}
        </span>
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        disabled={pending}
        className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-fysi-muted transition-colors hover:bg-fysi-cream hover:text-fysi-deep disabled:opacity-40"
        title="Dispensar aviso"
        aria-label={`Dispensar aviso: ${title}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}
