import { redirect } from "next/navigation";
import { getCurrentMember, getVisibleClientIds } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { AllTasksBoard } from "@/components/admin/all-tasks-board";
import { listAllProjectTasks } from "@/lib/project-tasks-server";

export const dynamic = "force-dynamic";

export default async function AdminTarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const visibleIds = await getVisibleClientIds(member);
  const allTasks = await listAllProjectTasks();
  const tasks = visibleIds
    ? allTasks.filter((t) => visibleIds.has(t.client_id))
    : allTasks;

  return (
    <AdminShell active="tarefas" keyParam={keyParamFirst} userEmail={member.email}>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
            Tarefas
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Todas as subtarefas de produção de todos os projetos, num lugar só.
          </p>
        </div>
      </header>

      <AllTasksBoard tasks={tasks} urlKey={urlKey ?? undefined} />
    </AdminShell>
  );
}
