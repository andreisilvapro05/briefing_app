import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Tabs no topo do admin: Clientes | Quadro | Cobranças | Relatórios | Contratos.
 * `keyParam` preserva ?key=... quando o admin entrou via URL key.
 */
export function AdminTabs({
  active,
  keyParam,
}: {
  active: "clientes" | "quadro" | "cobrancas" | "relatorios" | "contratos";
  keyParam: string;
}) {
  const tab = (isActive: boolean) =>
    cn(
      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap",
      isActive
        ? "text-fysi-deep border-fysi-deep"
        : "text-fysi-muted border-transparent hover:text-fysi-deep hover:border-fysi-deep/30"
    );

  return (
    <nav className="flex gap-1 border-b border-fysi-line mb-6 overflow-x-auto">
      <Link href={`/admin${keyParam}`} className={tab(active === "clientes")}>
        Clientes
      </Link>
      <Link
        href={`/admin/quadro${keyParam}`}
        className={tab(active === "quadro")}
      >
        Quadro
      </Link>
      <Link
        href={`/admin/cobrancas${keyParam}`}
        className={tab(active === "cobrancas")}
      >
        Cobranças
      </Link>
      <Link
        href={`/admin/relatorios${keyParam}`}
        className={tab(active === "relatorios")}
      >
        Relatórios
      </Link>
      <Link
        href={`/admin/contratos${keyParam}`}
        className={tab(active === "contratos")}
      >
        Contratos
      </Link>
    </nav>
  );
}
