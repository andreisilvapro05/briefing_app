import { redirect } from "next/navigation";
import Link from "next/link";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  GENERAL_LANES,
  LANE_TONE_CLASSES,
  computeStats,
  type ClientForLane,
} from "@/lib/workflow-lanes";
import { listAllProjectTasks } from "@/lib/project-tasks-server";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  isClosedTaskStatus,
} from "@/lib/project-tasks";

/**
 * Visão Geral — dashboard pros gestores: pizza selecionável, avisos de
 * clientes novos, tarefas pendentes da equipe, atalhos e busca. Pedido do
 * usuário (2026-08-31): "isso é essencial".
 *
 * Login ainda é compartilhado (sem usuário individual — Caixa 0 adiada),
 * então "tarefas do usuário da conta" mostra as tarefas pendentes de TODA
 * a equipe, não filtradas por pessoa — não dá pra saber quem está logado.
 */

export const dynamic = "force-dynamic";

const NOVOS_DIAS = 7;
const TAREFAS_LIMIT = 8;

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();
  const [{ data: clientsData }, allTasks] = await Promise.all([
    service
      .from("clients")
      .select(
        "id, nome, empresa, project_type, status, current_stage_index, briefing_submitted_at, contrato_preenchido_at, chamada_agendada_at, contrato_status, pagamento_total, pagamento_pago, last_client_activity_at, created_at"
      )
      .order("created_at", { ascending: false }),
    listAllProjectTasks(),
  ]);

  const clients = (clientsData as ClientForLane[]) ?? [];
  const stats = computeStats(clients);

  // Avisos de clientes novos — cadastrados nos últimos NOVOS_DIAS dias.
  const now = Date.now();
  const clientesNovos = clients.filter(
    (c) => (now - new Date(c.created_at).getTime()) / 86_400_000 <= NOVOS_DIAS
  );

  // Tarefas pendentes de toda a equipe, mais urgentes primeiro (vencimento
  // mais próximo/atrasado; sem vencimento vai pro fim).
  const tarefasPendentes = allTasks
    .filter((t) => !isClosedTaskStatus(t.status))
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

  // Pizza — mesma distribuição da Lista por status, versão compacta.
  const laneData = GENERAL_LANES.map((lane) => ({
    lane,
    count: stats.porLane.get(lane.id)?.length ?? 0,
  })).filter((d) => d.count > 0);
  const totalProjetos = laneData.reduce((s, d) => s + d.count, 0);

  return (
    <AdminShell active="visao-geral" keyParam={keyParam} userEmail={user.email}>
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

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        {/* Pizza selecionável — clica numa fatia, vai pra Lista por status já naquela etapa */}
        <section className="bg-white border border-fysi-line rounded-[20px] p-5">
          <div className="flex items-baseline justify-between mb-4">
            <Eyebrow>Projetos por status</Eyebrow>
            <Link
              href={`/admin/lista${keyParam}`}
              className="text-xs text-fysi-deep hover:underline font-medium"
            >
              Ver lista completa →
            </Link>
          </div>
          {totalProjetos === 0 ? (
            <p className="text-sm text-fysi-muted py-8 text-center">
              Sem projetos ainda.
            </p>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
              <MiniDonut data={laneData} total={totalProjetos} />
              <div className="flex flex-col gap-1">
                {laneData.map(({ lane, count }) => {
                  const tone = LANE_TONE_CLASSES[lane.tone];
                  const pct = Math.round((count / totalProjetos) * 100);
                  return (
                    <Link
                      key={lane.id}
                      href={`/admin/lista${keyParam}`}
                      className="flex items-center gap-2 text-xs rounded-md px-2 py-1 hover:bg-fysi-cream/60 transition"
                    >
                      <span className={`h-2 w-2 rounded-sm shrink-0 ${tone.dot}`} />
                      <span className="text-fysi-deep truncate flex-1">
                        {lane.label}
                      </span>
                      <span className="text-fysi-muted tabular-nums shrink-0">
                        {count} ({pct}%)
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Avisos de clientes novos */}
        <section className="bg-white border border-fysi-line rounded-[20px] p-5">
          <div className="flex items-baseline justify-between mb-4">
            <Eyebrow>Clientes novos</Eyebrow>
            <Pill tone="muted">últimos {NOVOS_DIAS} dias</Pill>
          </div>
          {clientesNovos.length === 0 ? (
            <p className="text-sm text-fysi-muted py-8 text-center">
              Nenhum cliente novo nos últimos {NOVOS_DIAS} dias.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {clientesNovos.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/${c.id}${keyParam}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-fysi-cream/60 transition text-sm"
                >
                  <span className="text-fysi-deep font-medium truncate">
                    {c.empresa || c.nome}
                  </span>
                  <span className="text-[0.72rem] text-fysi-muted shrink-0">
                    {formatDate(c.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

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

const R = 40;
const R_IN = 24;
const CX = 48;
const CY = 48;

function point(r: number, a: number): [number, number] {
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function annularPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = point(R, a0);
  const [ox1, oy1] = point(R, a1);
  const [ix1, iy1] = point(R_IN, a1);
  const [ix0, iy0] = point(R_IN, a0);
  return `M ${ox0} ${oy0} A ${R} ${R} 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${R_IN} ${R_IN} 0 ${large} 0 ${ix0} ${iy0} Z`;
}

const TONE_HEX: Record<string, string> = {
  slate: "#94a3b8",
  indigo: "#6366f1",
  yellow: "#eab308",
  pink: "#ec4899",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  red: "#ef4444",
  orange: "#f97316",
  emerald: "#10b981",
  rose: "#f43f5e",
};

function MiniDonut({
  data,
  total,
}: {
  data: { lane: { id: string; tone: string }; count: number }[];
  total: number;
}) {
  let acc = 0;
  const segs = data.map((d) => {
    const frac = d.count / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    return { ...d, a0, a1 };
  });

  return (
    <svg viewBox="0 0 96 96" className="w-24 h-24 shrink-0" role="img" aria-label="Distribuição de projetos por status">
      {segs.length === 1 ? (
        <circle
          cx={CX}
          cy={CY}
          r={(R + R_IN) / 2}
          fill="none"
          stroke={TONE_HEX[segs[0].lane.tone] ?? "#94a3b8"}
          strokeWidth={R - R_IN}
        />
      ) : (
        segs.map((s) => (
          <path
            key={s.lane.id}
            d={annularPath(s.a0, s.a1)}
            fill={TONE_HEX[s.lane.tone] ?? "#94a3b8"}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))
      )}
      <text
        x={CX}
        y={CY + 5}
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        style={{ fill: "var(--fysi-deep)" }}
      >
        {total}
      </text>
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
