import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ClientTab =
  | "geral"
  | "ei"
  | "briefing"
  | "contrato"
  | "pagamentos"
  | "entrega"
  | "problemas"
  | "drive"
  | "moodboard";

interface TabDef {
  id: ClientTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "geral", label: "Visão geral" },
  { id: "ei", label: "EI · Estrutura inicial" },
  { id: "briefing", label: "Briefing" },
  { id: "contrato", label: "Contrato" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "entrega", label: "DEP · Entrega" },
  { id: "problemas", label: "Problemas" },
  { id: "drive", label: "Drive" },
  { id: "moodboard", label: "Moodboard" },
];

function I({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<ClientTab, ReactNode> = {
  geral: (
    <I>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </I>
  ),
  ei: (
    <I>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 13h6M9 17h4" />
    </I>
  ),
  briefing: (
    <I>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </I>
  ),
  contrato: (
    <I>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 14l2 2 4-4" />
    </I>
  ),
  pagamentos: (
    <I>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </I>
  ),
  entrega: (
    <I>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </I>
  ),
  problemas: (
    <I>
      <path d="M10.3 4 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </I>
  ),
  drive: (
    <I>
      <path d="M4 5h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </I>
  ),
  moodboard: (
    <I>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M21 15l-5-5L5 20" />
    </I>
  ),
};

export interface TabBadge {
  tone: "mint" | "yellow" | "muted" | "amber";
  label: string;
}

export type ClientTabBadges = Partial<Record<ClientTab, TabBadge>>;

const TONE_CLASSES: Record<TabBadge["tone"], { bg: string; text: string }> = {
  mint: { bg: "bg-fysi-mint", text: "text-fysi-deep" },
  yellow: { bg: "bg-fysi-yellow", text: "text-fysi-deep" },
  muted: { bg: "bg-fysi-cream", text: "text-fysi-muted" },
  amber: { bg: "bg-amber-100", text: "text-amber-800" },
};

/**
 * Sidebar de navegação do /admin/[id] — as "caixinhas" do cliente.
 * Item ativo com fundo mint + barra mint-vivid de 3px. Preserva ?key=.
 * No mobile vira uma faixa horizontal rolável.
 */
export function ClientTabs({
  active,
  clientId,
  keyParam,
  badges = {},
}: {
  active: ClientTab;
  clientId: string;
  keyParam: string;
  badges?: ClientTabBadges;
}) {
  const keySuffix = keyParam.startsWith("?") ? `&${keyParam.slice(1)}` : keyParam;

  return (
    <nav
      className="md:w-[228px] md:shrink-0"
      aria-label="Seções do cliente"
    >
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:sticky md:top-4 pb-2 md:pb-0">
        {TABS.map((t) => {
          const isActive = active === t.id;
          const href =
            t.id === "geral"
              ? `/admin/${clientId}${keyParam}`
              : `/admin/${clientId}?tab=${t.id}${keySuffix}`;
          const badge = badges[t.id];
          return (
            <li key={t.id} className="shrink-0">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                style={
                  isActive
                    ? { boxShadow: "inset 3px 0 0 var(--fysi-mint-vivid)" }
                    : undefined
                }
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-[11px] text-[0.86rem] font-medium border transition whitespace-nowrap",
                  isActive
                    ? "bg-fysi-mint border-fysi-mint-vivid text-fysi-deep font-semibold"
                    : "border-transparent text-fysi-deep hover:bg-fysi-cream"
                )}
              >
                <span className={cn("shrink-0", isActive ? "text-fysi-deep" : "text-fysi-muted")}>
                  {ICONS[t.id]}
                </span>
                <span className="flex-1 min-w-0">{t.label}</span>
                {badge ? (
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center text-[0.62rem] font-semibold rounded-full px-2 py-0.5 leading-none",
                      TONE_CLASSES[badge.tone].bg,
                      TONE_CLASSES[badge.tone].text
                    )}
                  >
                    {badge.label}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
