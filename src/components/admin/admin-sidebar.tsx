import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sidebar global do admin (páginas de topo): Clientes | Quadro | Cobranças |
 * Relatórios | Contratos. Mesmo estilo da sidebar de caixinhas do cliente
 * (item ativo em mint + barra mint-vivid de 3px). Preserva ?key=.
 */

type AdminSection =
  | "clientes"
  | "quadro"
  | "cobrancas"
  | "relatorios"
  | "contratos";

interface NavItem {
  id: AdminSection;
  label: string;
  href: (k: string) => string;
  icon: ReactNode;
}

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

const NAV: NavItem[] = [
  {
    id: "clientes",
    label: "Clientes",
    href: (k) => `/admin${k}`,
    icon: (
      <I>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </I>
    ),
  },
  {
    id: "quadro",
    label: "Quadro",
    href: (k) => `/admin/quadro${k}`,
    icon: (
      <I>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M15 3v18" />
      </I>
    ),
  },
  {
    id: "cobrancas",
    label: "Cobranças",
    href: (k) => `/admin/cobrancas${k}`,
    icon: (
      <I>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </I>
    ),
  },
  {
    id: "relatorios",
    label: "Relatórios",
    href: (k) => `/admin/relatorios${k}`,
    icon: (
      <I>
        <path d="M3 3v18h18" />
        <rect x="7" y="10" width="3" height="7" />
        <rect x="13" y="6" width="3" height="11" />
      </I>
    ),
  },
  {
    id: "contratos",
    label: "Contratos",
    href: (k) => `/admin/contratos${k}`,
    icon: (
      <I>
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M9 15h6" />
      </I>
    ),
  },
];

export function AdminSidebar({
  active,
  keyParam,
}: {
  active: AdminSection;
  keyParam: string;
}) {
  return (
    <nav className="md:w-[212px] md:shrink-0" aria-label="Navegação do painel">
      <div className="hidden md:flex items-center gap-2 px-2 pb-4 mb-1">
        <span className="w-7 h-7 rounded-lg bg-fysi-deep text-fysi-mint grid place-items-center text-xs font-bold">
          F
        </span>
        <span className="font-semibold tracking-tight text-fysi-deep">
          fysi<span className="text-fysi-green font-medium">lab</span>
        </span>
      </div>
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:sticky md:top-4 pb-2 md:pb-0">
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href(keyParam)}
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
                <span
                  className={cn(
                    "shrink-0",
                    isActive ? "text-fysi-deep" : "text-fysi-muted"
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
