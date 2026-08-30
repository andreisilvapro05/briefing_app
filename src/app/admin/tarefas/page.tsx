import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
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
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const tasks = await listAllProjectTasks();

  return (
    <AdminShell active="tarefas" keyParam={keyParamFirst} userEmail={user.email}>
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
