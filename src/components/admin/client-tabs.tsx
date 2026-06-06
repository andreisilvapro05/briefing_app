import Link from "next/link";
import { cn } from "@/lib/cn";

export type ClientTab = "geral" | "briefing" | "financeiro" | "entrega";

interface TabDef {
  id: ClientTab;
  emoji: string;
  label: string;
  hint: string;
}

const TABS: TabDef[] = [
  {
    id: "geral",
    emoji: "📋",
    label: "Visão geral",
    hint: "Acesso, fases, dados",
  },
  {
    id: "briefing",
    emoji: "✏️",
    label: "Briefing & EI",
    hint: "Respostas e estrutura inicial",
  },
  {
    id: "financeiro",
    emoji: "💰",
    label: "Financeiro",
    hint: "Contrato e pagamento",
  },
  {
    id: "entrega",
    emoji: "📦",
    label: "Entrega",
    hint: "Documento final e Drive",
  },
];

/**
 * Status mostrado como pill discreta dentro de cada tab.
 * - tone: cor do dot
 * - label: texto curto (max ~12 chars pra caber)
 */
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
 * Abas internas do /admin/[id]. Server component que renderiza Links
 * com o tab atual destacado. Preserva ?key= via keyParam.
 *
 * `badges` permite passar status visual por aba (ex: briefing 7/8, contrato
 * pendente). Aparece como pill discreta ao lado do label.
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
  // keyParam vem como "?key=..." ou ""
  const keySuffix = keyParam.startsWith("?") ? `&${keyParam.slice(1)}` : keyParam;

  return (
    <nav
      className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-fysi-cream/95 backdrop-blur-md border-b border-fysi-line mb-6 overflow-x-auto"
      aria-label="Seções do cliente"
    >
      <ul className="flex gap-1 min-w-fit">
        {TABS.map((t) => {
          const isActive = active === t.id;
          const href =
            t.id === "geral"
              ? `/admin/${clientId}${keyParam}`
              : `/admin/${clientId}?tab=${t.id}${keySuffix}`;
          return (
            <li key={t.id}>
              <Link
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap",
                  isActive
                    ? "text-fysi-deep border-fysi-deep"
                    : "text-fysi-muted border-transparent hover:text-fysi-deep hover:border-fysi-deep/30"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="text-base">{t.emoji}</span>
                <span className="flex flex-col items-start leading-tight">
                  <span>{t.label}</span>
                  <span className="text-[0.65rem] text-fysi-muted font-normal hidden sm:block">
                    {t.hint}
                  </span>
                </span>
                {badges[t.id] ? (
                  <span
                    className={cn(
                      "ml-1 inline-flex items-center text-[0.65rem] font-semibold rounded-full px-2 py-0.5 leading-none",
                      TONE_CLASSES[badges[t.id]!.tone].bg,
                      TONE_CLASSES[badges[t.id]!.tone].text
                    )}
                  >
                    {badges[t.id]!.label}
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
