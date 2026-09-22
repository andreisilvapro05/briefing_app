import { redirect } from "next/navigation";
import {
  hasTaskScopedRole,
  getCurrentMember,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { AreasBoard } from "@/components/admin/areas-board";
import { listInternalTasks } from "@/lib/project-tasks-server";

export const dynamic = "force-dynamic";

/**
 * Demandas internas da agência, por área.
 *
 * Pedido da Karine (2026-09-21): o que chega pra ela e pra Tainá e não
 * pertence a projeto nenhum — comercial, curso, financeiro, processos,
 * marketing — não tinha onde ser registrado nem visto em conjunto.
 *
 * Separado de /admin/tarefas de propósito: lá é o trabalho de PROJETO, que
 * pertence a um cliente. Ela pediu explicitamente pra não misturar os dois.
 */
export default async function DemandasPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  // As gavetas Comercial, Curso e Financeiro são exatamente o que o papel
  // "basico" (designer) não deve ver — o mesmo corte de Contratos e
  // Cobranças. Sem isto, bastava saber a URL.
  if (!hasFullAccess(member)) redirect(`/admin/meu-trabalho${keyParam}`);

  const tasks = await listInternalTasks();

  return (
    <AdminShell
      active="demandas"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Demandas internas
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          O trabalho da agência que não é de um projeto de cliente. Cada área
          tem sua gaveta, e qualquer pessoa da equipe pode registrar o que
          chega.
        </p>
      </header>

      <AreasBoard
        tasks={tasks}
        urlKey={urlKey}
        meuResponsavel={member.taskValue ?? ""}
        lockResponsavel={hasTaskScopedRole(member)}
      />
    </AdminShell>
  );
}
