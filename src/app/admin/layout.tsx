import type { ReactNode } from "react";

/**
 * Layout do painel admin. Aplica o escopo de paleta "Slate Fysi" (neutros
 * graphite-teal frios) a todas as rotas /admin, sem afetar as telas do cliente.
 * Ver `.admin-scope` em globals.css.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-scope">{children}</div>;
}
