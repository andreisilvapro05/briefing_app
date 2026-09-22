import { redirect } from "next/navigation";
import {
  hasTaskScopedRole, getCurrentMember, getVisibleClientIds, hasFinanceAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { AllTasksBoard } from "@/components/admin/all-tasks-board";
import { listAllProjectTasks, listClientOptions } from "@/lib/project-tasks-server";
import { TEAM_MEMBERS } from "@/lib/project-tasks";

export const dynamic = "force-dynamic";

export default async function AdminTarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; resp?: string }>;
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
        clients={clientOptions}
        restrictToResponsavel={
          hasTaskScopedRole(member) ? member.taskValue : undefined
        }
        // Cada aba tem seu endereço (?resp=valeria), como as views do
        // ClickUp: recarregar mantém a lista, e o link pode ser mandado.
        // Valor desconhecido na URL cai em "Todos" — um ?resp= errado
        // mostrava uma lista vazia sem aba acesa, que parece defeito.
        viewInicial={abaValida(params.resp)}
      />
    </AdminShell>
  );
}

/** Só abas que existem: as da equipe e a das tarefas sem responsável. */
function abaValida(valor: string | undefined): string {
  if (!valor) return "";
  if (valor === "__sem__") return valor;
  return TEAM_MEMBERS.some((m) => m.value === valor) ? valor : "";
}
