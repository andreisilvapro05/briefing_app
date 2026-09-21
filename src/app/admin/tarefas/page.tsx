import { redirect } from "next/navigation";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { AllTasksBoard } from "@/components/admin/all-tasks-board";
import { listAllProjectTasks, listClientOptions } from "@/lib/project-tasks-server";
import { getEIDocumentIdsForClients } from "@/lib/ei-documents-server";

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
  const [allTasks, clientOptions] = await Promise.all([
    listAllProjectTasks(),
    listClientOptions(visibleIds),
  ]);
  // Esta tela é "todas as subtarefas de produção", agrupadas por cliente.
  // Demanda interna (sem cliente) não tem lugar aqui — ela aparece em
  // "Meu Trabalho", que é organizado por pessoa.
  const comCliente = allTasks.filter(
    (t): t is (typeof allTasks)[number] & {
      client: NonNullable<(typeof allTasks)[number]["client"]>;
      client_id: string;
    } => t.client !== null && t.client_id !== null
  );
  const tasks = visibleIds
    ? comCliente.filter((t) => visibleIds.has(t.client_id))
    : comCliente;
  const eiDocIds = await getEIDocumentIdsForClients([
    ...new Set(tasks.map((t) => t.client_id)),
  ]);
  const eiDocIdByClient = Object.fromEntries(eiDocIds);

  return (
    <AdminShell active="tarefas" keyParam={keyParamFirst} userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)} hideFinance={!hasFinanceAccess(member)}>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
            Tarefas
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Todas as subtarefas de produção de todos os projetos, num lugar só.
          </p>
        </div>
      </header>

      <AllTasksBoard
        tasks={tasks}
        urlKey={urlKey ?? undefined}
        keyParam={keyParamFirst}
        eiDocIdByClient={eiDocIdByClient}
        clients={clientOptions}
        restrictToResponsavel={
          member.role === "basico" ? member.taskValue : undefined
        }
      />
    </AdminShell>
  );
}
