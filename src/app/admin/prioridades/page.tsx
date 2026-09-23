import { redirect } from "next/navigation";
import {
  getCurrentMember,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { PrioridadesBoard } from "@/components/admin/prioridades-board";
import { listarIniciativas } from "@/lib/prioridades-server";
import { MatrizDemandas } from "@/components/admin/matriz-demandas";
import { MatrizProjetos } from "@/components/admin/matriz-projetos";
import { montarMatrizProjetos } from "@/lib/prioridades-projetos";
import { listAllProjectTasks } from "@/lib/project-tasks-server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { TASK_STATUS_GROUP, type TaskStatus } from "@/lib/project-tasks";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";
import { hojeEmBrasilia } from "@/lib/datas";
import Link from "next/link";

type Aba = "iniciativas" | "demandas" | "projetos";

const ABAS: { id: Aba; label: string; hint: string }[] = [
  {
    id: "iniciativas",
    label: "Iniciativas",
    hint: "o que a agência pode construir pra ganhar tempo ou dinheiro",
  },
  {
    id: "demandas",
    label: "Demandas internas",
    hint: "urgente × importante, no trabalho que não é de projeto",
  },
  {
    id: "projetos",
    label: "Projetos",
    hint: "qual cliente atender primeiro, pelo prazo e pelo que falta",
  },
];

export const dynamic = "force-dynamic";

/**
 * Prioridades — o mapa de onde investir esforço.
 *
 * Pedido da Karine (2026-09-22): "ter uma parte de visualização também de
 * ordem de importância de execução (...) tanto para eu e a Tainá (comercial,
 * atendimento e marketing) como também para o Andrei na parte de processos e
 * gestão."
 *
 * O que está aqui NÃO é tarefa de projeto (isso é /admin/tarefas) nem demanda
 * interna (/admin/demandas): é a melhoria que a agência pode fazer pra ganhar
 * dia de projeto ou fechar mais contrato. Ela vive enquanto a agência existir.
 *
 * QUEM VÊ: `hasFullAccess` — admin (sócio), avançado e a sessão legada. O
 * mesmo corte de /admin/demandas, e pelo mesmo motivo: a tela diz onde o
 * faturamento trava e onde a agência vai investir. O papel "basico"
 * (designer) e o "desenvolvedor" não entram. Barrado aqui no servidor, antes
 * de qualquer HTML — esconder o item do menu não impede ninguém de digitar a
 * URL, e cada Server Action refaz a checagem por conta própria.
 */
export default async function PrioridadesPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; aba?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  if (!hasFullAccess(member)) redirect(`/admin/meu-trabalho${keyParam}`);

  const aba: Aba = ABAS.some((a) => a.id === params.aba)
    ? (params.aba as Aba)
    : "iniciativas";

  // Cada aba carrega só o que ela mostra — a de iniciativas não precisa das
  // tarefas de todos os clientes, e a de projetos não precisa das iniciativas.
  const iniciativas = aba === "iniciativas" ? await listarIniciativas() : [];

  let demandas: Awaited<ReturnType<typeof listAllProjectTasks>> = [];
  if (aba === "demandas") {
    const todas = await listAllProjectTasks();
    demandas = todas.filter(
      (t) => t.client_id === null && TASK_STATUS_GROUP[t.status] !== "fechado"
    );
  }

  let projetos: ReturnType<typeof montarMatrizProjetos> = [];
  if (aba === "projetos") {
    const service = createSupabaseServiceRoleClient();
    const { data } = await service
      .from("clients")
      .select("id, nome, empresa, project_type, status, last_client_activity_at, created_at");
    const linhas =
      (data as {
        id: string;
        nome: string | null;
        empresa: string | null;
        project_type: string | null;
        status: string | null;
        last_client_activity_at: string | null;
        created_at: string;
      }[] | null) ?? [];
    const tarefas = await listAllProjectTasks();
    projetos = montarMatrizProjetos(
      linhas.map((c) => ({
        id: c.id,
        nome: c.empresa?.trim() || c.nome?.trim() || "Sem nome",
        tipo: c.project_type
          ? (PROJECT_TYPE_LABELS[c.project_type as keyof typeof PROJECT_TYPE_LABELS] ??
            c.project_type)
          : "—",
        status: (c.status ?? "a-iniciar") as TaskStatus,
        last_client_activity_at: c.last_client_activity_at,
        created_at: c.created_at,
      })),
      tarefas,
      hojeEmBrasilia()
    );
  }

  return (
    <AdminShell
      active="prioridades"
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
          Prioridades
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          {ABAS.find((a) => a.id === aba)?.hint}
        </p>
      </header>

      {/* Três perguntas diferentes, três abas. Misturá-las numa tela só
          faria uma esconder a outra: iniciativa vive enquanto a agência
          existir, demanda interna vira e mexe, projeto tem prazo. */}
      <div
        role="tablist"
        aria-label="O que priorizar"
        className="flex items-end gap-1 overflow-x-auto border-b border-fysi-line mb-5"
      >
        {ABAS.map((a) => {
          const ativa = a.id === aba;
          const sep = keyParam ? "&" : "?";
          return (
            <Link
              key={a.id}
              href={`/admin/prioridades${keyParam}${sep}aba=${a.id}`}
              role="tab"
              aria-selected={ativa}
              className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition ${
                ativa
                  ? "border-fysi-deep text-fysi-deep font-semibold"
                  : "border-transparent text-fysi-muted hover:text-fysi-deep hover:border-fysi-line-strong"
              }`}
            >
              {a.label}
            </Link>
          );
        })}
      </div>

      {aba === "iniciativas" ? (
        <PrioridadesBoard iniciativas={iniciativas} urlKey={urlKey} />
      ) : aba === "demandas" ? (
        <MatrizDemandas demandas={demandas} urlKey={urlKey} />
      ) : (
        <MatrizProjetos projetos={projetos} keyParam={keyParam} />
      )}
    </AdminShell>
  );
}
