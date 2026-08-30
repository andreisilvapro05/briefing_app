import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * AdminShell — layout do painel no estilo ClickUp: sidebar de ÁREAS da empresa
 * (Projetos / Financeiro / Marketing) à esquerda, barra superior com o usuário,
 * e conteúdo full-width (ocupa a tela, sem margem centralizada desperdiçada).
 *
 * Substitui o antigo Shell + ContentFrame + AdminSidebar nas telas de topo.
 */

export type AdminSection =
  | "clientes"
  | "lista"
  | "briefings"
  | "quadro"
  | "tarefas"
  | "estruturas-iniciais"
  | "conteudo"
  | "contratos"
  | "cobrancas"
  | "relatorios";

interface NavItem {
  id: AdminSection;
  label: string;
  href: (k: string) => string;
  icon: ReactNode;
}

interface NavArea {
  label: string;
  items: NavItem[];
}

function I({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
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

const ICONS: Record<AdminSection, ReactNode> = {
  clientes: (
    <I>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </I>
  ),
  lista: (
    <I>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </I>
  ),
  briefings: (
    <I>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 9h1M9 13h6M9 17h6" />
    </I>
  ),
  quadro: (
    <I>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18" />
    </I>
  ),
  tarefas: (
    <I>
      <rect x="3" y="5" width="4" height="4" rx="1" />
      <path d="M9 7h12" />
      <rect x="3" y="15" width="4" height="4" rx="1" />
      <path d="M9 17h12" />
    </I>
  ),
  "estruturas-iniciais": (
    <I>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </I>
  ),
  conteudo: (
    <I>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </I>
  ),
  contratos: (
    <I>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 15h6" />
    </I>
  ),
  cobrancas: (
    <I>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </I>
  ),
  relatorios: (
    <I>
      <path d="M3 3v18h18" />
      <rect x="7" y="10" width="3" height="7" />
      <rect x="13" y="6" width="3" height="11" />
    </I>
  ),
};

function item(
  id: AdminSection,
  label: string,
  path: string
): NavItem {
  return {
    id,
    label,
    href: (k) => `${path}${k}`,
    icon: ICONS[id],
  };
}

const AREAS: NavArea[] = [
  {
    label: "Projetos",
    items: [
      item("clientes", "Clientes", "/admin"),
      item("lista", "Lista por status", "/admin/lista"),
      item("briefings", "Briefings", "/admin/briefings"),
      item("quadro", "Quadro", "/admin/quadro"),
      item("tarefas", "Tarefas", "/admin/tarefas"),
      item("estruturas-iniciais", "Estruturas Iniciais", "/admin/estruturas-iniciais"),
    ],
  },
  {
    label: "Financeiro",
    items: [
      item("contratos", "Contratos", "/admin/contratos"),
      item("cobrancas", "Cobranças", "/admin/cobrancas"),
      item("relatorios", "Relatórios", "/admin/relatorios"),
    ],
  },
  {
    label: "Marketing",
    items: [item("conteudo", "Conteúdo", "/admin/conteudo")],
  },
];

const LABELS: Record<AdminSection, { area: string; label: string }> = (() => {
  const m: Record<string, { area: string; label: string }> = {};
  for (const area of AREAS) {
    for (const it of area.items) m[it.id] = { area: area.label, label: it.label };
  }
  return m as Record<AdminSection, { area: string; label: string }>;
})();

export function AdminShell({
  active,
  keyParam,
  userEmail,
  children,
}: {
  active: AdminSection;
  keyParam: string;
  userEmail?: string | null;
  children: ReactNode;
}) {
  const crumb = LABELS[active];
  const initials = (userEmail ?? "F").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-fysi-cream text-fysi-deep">
      {/* Sidebar de áreas */}
      <aside className="hidden md:flex w-[236px] shrink-0 flex-col bg-white border-r border-fysi-line h-screen sticky top-0">
        <Link
          href={`/admin${keyParam}`}
          className="flex items-center gap-2.5 px-4 h-14 border-b border-fysi-line hover:bg-fysi-cream/60 transition shrink-0"
        >
          <span className="w-8 h-8 grid place-items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fysilab-symbol.png" alt="" className="h-full w-auto" />
          </span>
          <span className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-semibold tracking-tight truncate">
              Fysi Workspace
            </span>
            <span className="text-[0.65rem] text-fysi-muted">Painel interno</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 flex flex-col gap-4">
          {AREAS.map((area) => (
            <div key={area.label}>
              <p className="px-2 mb-1 text-[0.62rem] uppercase tracking-[0.14em] text-fysi-muted font-semibold">
                {area.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {area.items.map((it) => {
                  const isActive = it.id === active;
                  return (
                    <li key={it.id}>
                      <Link
                        href={it.href(keyParam)}
                        aria-current={isActive ? "page" : undefined}
                        style={
                          isActive
                            ? { boxShadow: "inset 3px 0 0 var(--fysi-mint-vivid)" }
                            : undefined
                        }
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-[0.86rem] font-medium border transition",
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
                          {it.icon}
                        </span>
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Coluna principal */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Topbar com usuário */}
        <header className="h-14 shrink-0 border-b border-fysi-line bg-white/90 backdrop-blur flex items-center justify-between gap-3 px-4 md:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <span className="md:hidden font-semibold">fysilab</span>
            <span className="hidden md:inline text-fysi-muted">
              {crumb?.area ?? "Painel"}
            </span>
            <span className="hidden md:inline text-fysi-muted/50">/</span>
            <span className="font-semibold truncate">{crumb?.label ?? ""}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-[0.78rem] font-medium text-fysi-deep truncate max-w-[180px]">
                {userEmail ?? "Equipe Fysi"}
              </span>
              <Link
                href="/api/auth/admin-logout"
                className="text-[0.68rem] text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
              >
                sair
              </Link>
            </span>
            <span className="w-9 h-9 rounded-full bg-fysi-deep text-fysi-mint grid place-items-center text-xs font-bold shrink-0">
              {initials}
            </span>
          </div>
        </header>

        {/* Nav horizontal no mobile */}
        <nav className="md:hidden border-b border-fysi-line bg-white overflow-x-auto">
          <ul className="flex gap-1 px-3 py-2 w-max">
            {AREAS.flatMap((a) => a.items).map((it) => {
              const isActive = it.id === active;
              return (
                <li key={it.id}>
                  <Link
                    href={it.href(keyParam)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition",
                      isActive
                        ? "bg-fysi-mint border-fysi-mint-vivid text-fysi-deep"
                        : "border-fysi-line text-fysi-muted"
                    )}
                  >
                    {it.icon}
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
