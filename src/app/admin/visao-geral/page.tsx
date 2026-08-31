import { redirect } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/pill";
import { getCurrentMember, getVisibleClientIds } from "@/lib/member";
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
    <AdminShell active="visao-geral" keyParam={keyParam} userEmail={member.email}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
          Visão Geral
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Painel de gestão — o que precisa da sua atenção agora.
        </p>
      </header>

      {/* Busca */}
      <form
        method="get"
        action={`/admin${keyParam}`}
        className="bg-white border border-fysi-line rounded-[16px] p-3 mb-6 flex gap-2"
      >
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
        <input
          type="search"
          name="q"
          placeholder="Buscar cliente por nome, e-mail ou empresa…"
          className="flex-1 rounded-[10px] border border-fysi-line bg-fysi-cream/40 px-3 py-2 text-sm text-fysi-deep placeholder:text-fysi-muted focus:outline-none focus:border-fysi-deep/40"
        />
        <button
          type="submit"
          className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90 shrink-0"
        >
          Buscar
        </button>
      </form>

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <ShortcutCard href={`/admin${keyParam}`} label="Clientes" />
        <ShortcutCard href={`/admin/contratos${keyParam}`} label="Contratos" />
        <ShortcutCard
          href={`/admin/estruturas-iniciais${keyParam}`}
          label="Estruturas Iniciais"
        />
        <ShortcutCard href={`/admin/briefings${keyParam}`} label="Briefings" />
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
                    className={`inline-block rounded-full border text-[0.68rem] font-medium px-2 py-0.5 ${TASK_STATUS_TONE[t.status]}`}
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

function ShortcutCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="bg-white border border-fysi-line rounded-[14px] px-4 py-3 text-sm font-medium text-fysi-deep hover:border-fysi-deep/40 hover:bg-fysi-cream/40 transition text-center"
    >
      {label}
    </Link>
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
