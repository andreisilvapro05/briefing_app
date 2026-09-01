import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/pill";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { getLaneGroups } from "@/lib/lane-groups-server";
import { listAllProjectTasks } from "@/lib/project-tasks-server";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  isClosedTaskStatus,
} from "@/lib/project-tasks";
import { StatusPieBoard } from "@/components/admin/status-pie-board";

/**
 * Visão Geral — dashboard pros gestores: pizza selecionável, tarefas
 * pendentes da equipe, atalhos e busca. Pedido do usuário (2026-08-31):
 * "isso é essencial".
 *
 * Filtrada por getVisibleClientIds() (Caixa 0) — um membro "basico" só vê
 * a pizza/tarefas dos clientes em que está marcado. Ainda mostra tarefas
 * de TODA a equipe visível (não só as atribuídas à pessoa logada) — falta
 * granularidade por responsável dentro do próprio escopo visível.
 */

export const dynamic = "force-dynamic";

const TAREFAS_LIMIT = 8;

export default async function VisaoGeralPage({
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
  const [allTasks, laneGroups] = await Promise.all([
    listAllProjectTasks(),
    getLaneGroups(visibleIds),
  ]);

  // Tarefas pendentes de toda a equipe visível a este membro, mais urgentes
  // primeiro (vencimento mais próximo/atrasado; sem vencimento vai pro fim).
  const tarefasPendentes = allTasks
    .filter((t) => !isClosedTaskStatus(t.status))
    .filter((t) => !visibleIds || visibleIds.has(t.client_id))
    .sort((a, b) => {
      if (!a.data_vencimento && !b.data_vencimento) return 0;
      if (!a.data_vencimento) return 1;
      if (!b.data_vencimento) return -1;
      return (
        new Date(a.data_vencimento).getTime() -
        new Date(b.data_vencimento).getTime()
      );
    })
    .slice(0, TAREFAS_LIMIT);

  return (
    <AdminShell active="visao-geral" keyParam={keyParam} userEmail={member.email} hideFinance={!hasFinanceAccess(member)}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
          Visão Geral
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Painel de gestão — o que precisa da sua atenção agora.
        </p>
      </header>

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <ShortcutCard href={`/admin${keyParam}`} label="Clientes" icon={<ClientesIcon />} />
        <ShortcutCard
          href={`/admin/contratos${keyParam}`}
          label="Contratos"
          icon={<ContratosIcon />}
        />
        <ShortcutCard
          href={`/admin/estruturas-iniciais${keyParam}`}
          label="Estruturas Iniciais"
          icon={<EstruturasIcon />}
        />
        <ShortcutCard
          href={`/admin/briefings${keyParam}`}
          label="Briefings"
          icon={<BriefingsIcon />}
        />
      </div>

      {/* Projetos por status — pizza selecionável + lista com accordion de
          subtarefas editável, mesmo componente completo da Lista por
          status (não uma versão resumida). */}
      <section className="mb-6">
        <StatusPieBoard
          groups={laneGroups}
          keyParam={keyParam}
          urlKey={urlKey ?? undefined}
          novoHref={novoHref}
          restrictToResponsavel={
            member.role === "basico" ? member.taskValue : undefined
          }
        />
      </section>

      {/* Tarefas pendentes */}
      <section className="bg-white border border-fysi-line rounded-[20px] p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <Eyebrow>Tarefas pendentes da equipe</Eyebrow>
          <Link
            href={`/admin/tarefas${keyParam}`}
            className="text-xs text-fysi-deep hover:underline font-medium"
          >
            Ver todas →
          </Link>
        </div>
        <p className="text-[0.7rem] text-fysi-muted -mt-2 mb-3">
          Login ainda é compartilhado — mostrando as mais urgentes de toda a
          equipe, não só as suas.
        </p>
        {tarefasPendentes.length === 0 ? (
          <p className="text-sm text-fysi-muted py-6 text-center">
            Nenhuma tarefa pendente 🎉
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tarefasPendentes.map((t) => (
              <Link
                key={t.id}
                href={`/admin/${t.client_id}${keyParam}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-fysi-cream/60 transition text-sm"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-fysi-deep font-medium truncate">
                    {t.titulo}
                  </span>
                  <span className="text-[0.72rem] text-fysi-muted truncate">
                    {t.client.empresa || t.client.nome}
                    {t.responsavel ? ` · ${t.responsavel}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.data_vencimento ? (
                    <span className="text-[0.7rem] text-fysi-muted tabular-nums">
                      {formatDate(t.data_vencimento)}
                    </span>
                  ) : null}
                  <span
                    className={`inline-block rounded-full border text-xs font-medium px-2 py-0.5 ${TASK_STATUS_TONE[t.status]}`}
                  >
                    {TASK_STATUS_OPTIONS.find((o) => o.value === t.status)
                      ?.label ?? t.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function ShortcutCard({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-2.5 bg-white border border-fysi-line rounded-[14px] px-4 py-3.5 text-sm font-medium text-fysi-deep hover:border-fysi-deep/40 hover:bg-fysi-cream/40 transition"
    >
      <span className="shrink-0 text-fysi-muted group-hover:text-fysi-deep transition">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute top-2.5 right-2.5 text-fysi-muted/50 group-hover:text-fysi-deep transition"
        aria-hidden
      >
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </svg>
    </Link>
  );
}

const ICON_PROPS = {
  width: "17",
  height: "17",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.7",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function ClientesIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ContratosIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 15h6" />
    </svg>
  );
}

function EstruturasIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function BriefingsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 9h1M9 13h6M9 17h6" />
    </svg>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}
