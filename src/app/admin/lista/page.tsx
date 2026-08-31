import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { getLaneGroups } from "@/lib/lane-groups-server";
import { StatusPieBoard } from "@/components/admin/status-pie-board";

export const dynamic = "force-dynamic";

export default async function AdminListaPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const novoHref = `/admin/novo${keyParam}`;

  const visibleIds = await getVisibleClientIds(member);
  const groups = await getLaneGroups(visibleIds);

  return (
    <AdminShell active="lista" keyParam={keyParam} userEmail={member.email} hideFinance={!hasFinanceAccess(member)}>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
            Projetos por status
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Clique numa fatia da pizza pra ver os projetos daquela etapa. Mude o
            status na linha pra mover o projeto.
          </p>
        </div>
        <Link
          href={novoHref}
          className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
        >
          + Novo projeto
        </Link>
      </header>

      <StatusPieBoard
        groups={groups}
        keyParam={keyParam}
        urlKey={urlKey ?? undefined}
        novoHref={novoHref}
      />
    </AdminShell>
  );
}
