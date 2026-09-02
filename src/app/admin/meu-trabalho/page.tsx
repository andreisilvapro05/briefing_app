import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { listAllProjectTasks } from "@/lib/project-tasks-server";
import { MyWorkBoard } from "@/components/admin/my-work-board";

export const dynamic = "force-dynamic";

/** Hora local de Brasília, independente do timezone do servidor (Vercel roda em UTC). */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date())
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string): string {
  if (name.includes("(sessão compartilhada)")) return "";
  return name.split(" ")[0] ?? name;
}

export default async function MeuTrabalhoPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const nome = firstName(member.name);

  const allTasks = member.taskValue ? await listAllProjectTasks() : [];
  const myTasks = allTasks.filter((t) => t.responsavel === member.taskValue);

  return (
    <AdminShell
      active="meu-trabalho"
      keyParam={keyParam}
      userEmail={member.email}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
          {greeting()}{nome ? `, ${nome}` : ""}
        </h1>
      </header>

      {!member.taskValue ? (
        <section className="bg-white border border-fysi-line rounded-[20px] p-8 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            Sua conta ainda não está ligada a um responsável de tarefas
          </p>
          <p className="text-sm text-fysi-muted max-w-md mx-auto">
            Pra ver suas tarefas aqui, é preciso ligar seu login ao
            responsável correspondente em{" "}
            <Link
              href={`/admin/membros${keyParam}`}
              className="text-fysi-deep underline"
            >
              Membros
            </Link>
            .
          </p>
        </section>
      ) : (
        <MyWorkBoard tasks={myTasks} keyParam={keyParam} urlKey={urlKey} />
      )}
    </AdminShell>
  );
}
