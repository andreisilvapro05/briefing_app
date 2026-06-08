import { redirect } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  statsCobrancas,
  formatBRL as formatBRLCobrancas,
  type CobrancaMensal,
} from "@/lib/cobrancas-mensais";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";
import {
  GENERAL_LANES,
  LANE_TONE_CLASSES,
  computeStats,
  type ClientForLane,
} from "@/lib/workflow-lanes";

export const dynamic = "force-dynamic";

export default async function AdminRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select(
      "id, nome, empresa, project_type, status, current_stage_index, briefing_submitted_at, contrato_preenchido_at, chamada_agendada_at, contrato_status, pagamento_total, pagamento_pago, last_client_activity_at, created_at"
    )
    .order("created_at", { ascending: false });

  const clients = (data as ClientForLane[]) ?? [];
  const stats = computeStats(clients);

  // Cobranças mensais — pra mostrar MRR + receita recorrente no relatório
  const { data: cobrancasData } = await service
    .from("cobrancas_mensais")
    .select("*");
  const cobrancas = (cobrancasData as CobrancaMensal[]) ?? [];
  const cobrancasStats = statsCobrancas(cobrancas);

  const ativos = stats.total - (stats.porLane.get("entregue")?.length ?? 0) - (stats.porLane.get("parado")?.length ?? 0);
  const entregues = stats.porLane.get("entregue")?.length ?? 0;
  const parados = stats.porLane.get("parado")?.length ?? 0;
  const conversionRate = stats.total > 0 ? (entregues / stats.total) * 100 : 0;

  const maxMes = Math.max(1, ...stats.ultimosMeses.map((m) => m.count));
  const maxLane = Math.max(
    1,
    ...GENERAL_LANES.map((l) => stats.porLane.get(l.id)?.length ?? 0)
  );
  const tipoEntries = Array.from(stats.porTipo.entries())
    .sort((a, b) => b[1] - a[1]);
  const maxTipo = Math.max(1, ...tipoEntries.map(([, n]) => n));

  return (
    <Shell tone="cream" sectionLabel="Admin · Relatórios">
      <ContentFrame size="xl">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <Eyebrow>Painel interno</Eyebrow>
            <h1 className="fysi-display text-3xl md:text-4xl mt-2">Relatórios</h1>
            <p className="text-fysi-muted text-sm mt-2">
              Visão geral de pipeline, conversão, receita e saúde dos projetos.
            </p>
          </div>
          <Pill tone="muted">{stats.total} clientes</Pill>
        </header>

        <AdminTabs active="relatorios" keyParam={keyParamFirst} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Em andamento" value={String(ativos)} sub="todas as lanes ativas" />
          <Kpi
            label="Entregues"
            value={String(entregues)}
            sub={`${conversionRate.toFixed(0)}% de conversão`}
            tone="emerald"
          />
          <Kpi
            label="Parados"
            value={String(parados)}
            sub={parados > 0 ? "precisam atenção" : "tudo em dia"}
            tone={parados > 0 ? "amber" : "slate"}
          />
          <Kpi
            label="Novos / mês"
            value={stats.mediaPorMes.toFixed(1)}
            sub="média últimos 6m"
          />
        </div>

        {/* Receita recorrente (MRR) — só aparece se tem cobrança cadastrada */}
        {cobrancasStats.total > 0 ? (
          <section className="bg-white rounded-[20px] border border-fysi-line p-5 mb-6">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <Eyebrow>💚 Receita recorrente (MRR)</Eyebrow>
              <a
                href={`/admin/cobrancas${keyParamFirst}`}
                className="text-xs text-fysi-deep hover:underline font-medium"
              >
                Gerenciar cobranças →
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  MRR
                </div>
                <div className="text-2xl font-bold text-fysi-deep mt-1 tabular-nums">
                  {formatBRLCobrancas(cobrancasStats.mrr)}
                </div>
                <div className="text-[0.7rem] text-fysi-muted mt-0.5">
                  {cobrancasStats.ativas} ativas
                </div>
              </div>
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  Recebido este mês
                </div>
                <div className="text-2xl font-bold text-fysi-deep mt-1 tabular-nums">
                  {formatBRLCobrancas(cobrancasStats.recebidoEsteMes)}
                </div>
                <div className="text-[0.7rem] text-fysi-muted mt-0.5">
                  {cobrancasStats.pagos.length} pagas
                </div>
              </div>
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  A receber
                </div>
                <div
                  className={`text-2xl font-bold mt-1 tabular-nums ${cobrancasStats.aReceberEsteMes > 0 ? "text-amber-700" : "text-fysi-deep"}`}
                >
                  {formatBRLCobrancas(cobrancasStats.aReceberEsteMes)}
                </div>
                <div className="text-[0.7rem] text-fysi-muted mt-0.5">
                  {cobrancasStats.aCobrar.length + cobrancasStats.atrasados.length} pendentes
                </div>
              </div>
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  Em atraso
                </div>
                <div
                  className={`text-2xl font-bold mt-1 tabular-nums ${cobrancasStats.atrasados.length > 0 ? "text-red-700" : "text-fysi-deep"}`}
                >
                  {cobrancasStats.atrasados.length}
                </div>
                <div className="text-[0.7rem] text-fysi-muted mt-0.5">
                  {cobrancasStats.atrasados.length > 0 ? "precisam atenção" : "tudo em dia"}
                </div>
              </div>
            </div>
            {cobrancasStats.atrasados.length > 0 ? (
              <div className="mt-4 pt-4 border-t border-fysi-line">
                <p className="text-[0.7rem] uppercase tracking-[0.1em] text-amber-800 font-semibold mb-2">
                  ⚠ Atrasadas este mês:
                </p>
                <div className="flex flex-wrap gap-2">
                  {cobrancasStats.atrasados.slice(0, 8).map((c) => (
                    <a
                      key={c.id}
                      href={`/admin/cobrancas?status=atrasados${urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""}`}
                      className="text-xs bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 text-amber-900 hover:bg-amber-100"
                    >
                      {c.nome} · {formatBRLCobrancas(Number(c.valor_mensal))}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="bg-white rounded-[20px] border border-fysi-line p-5 mb-6 text-center">
            <Eyebrow>💚 Receita recorrente (MRR)</Eyebrow>
            <p className="text-sm text-fysi-muted mt-2 mb-3">
              Nenhuma cobrança mensal cadastrada ainda. Use a aba Cobranças pra
              adicionar clientes recorrentes (SEO, manutenção, hosting).
            </p>
            <a
              href={`/admin/cobrancas${keyParamFirst}`}
              className="inline-flex items-center text-xs font-medium text-fysi-deep hover:underline"
            >
              + Adicionar primeira cobrança →
            </a>
          </section>
        )}

        <div className="grid lg:grid-cols-2 gap-5 mb-6">
          {/* Receita */}
          <section className="bg-white rounded-[20px] border border-fysi-line p-5">
            <div className="flex items-baseline justify-between mb-4">
              <Eyebrow>Receita</Eyebrow>
              <span className="text-[0.7rem] text-fysi-muted">
                clientes com pagamento cadastrado
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  Total contratado
                </div>
                <div className="text-xl font-bold text-fysi-deep mt-1 tabular-nums">
                  {formatBRL(stats.receitaTotal)}
                </div>
              </div>
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  Recebido
                </div>
                <div className="text-xl font-bold text-fysi-deep mt-1 tabular-nums">
                  {formatBRL(stats.receitaPaga)}
                </div>
              </div>
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  Pendente
                </div>
                <div
                  className={`text-xl font-bold mt-1 tabular-nums ${
                    stats.receitaPendente > 0 ? "text-amber-700" : "text-fysi-deep"
                  }`}
                >
                  {formatBRL(stats.receitaPendente)}
                </div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-fysi-line/60 overflow-hidden">
              <div
                className="h-full bg-fysi-deep"
                style={{
                  width: `${
                    stats.receitaTotal > 0
                      ? Math.min(100, (stats.receitaPaga / stats.receitaTotal) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-[0.7rem] text-fysi-muted mt-1.5">
              {stats.receitaTotal > 0
                ? `${((stats.receitaPaga / stats.receitaTotal) * 100).toFixed(0)}% recebido`
                : "Sem pagamentos cadastrados"}
            </div>
          </section>

          {/* Novos clientes por mês */}
          <section className="bg-white rounded-[20px] border border-fysi-line p-5">
            <div className="flex items-baseline justify-between mb-4">
              <Eyebrow>Novos clientes — 6 meses</Eyebrow>
              <span className="text-[0.7rem] text-fysi-muted">
                média {stats.mediaPorMes.toFixed(1)}/mês
              </span>
            </div>
            <div className="flex items-end gap-2 h-32">
              {stats.ultimosMeses.map((m, i) => {
                const h = (m.count / maxMes) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                    <div className="text-[0.65rem] font-medium text-fysi-deep tabular-nums">
                      {m.count}
                    </div>
                    <div
                      className="w-full bg-fysi-deep rounded-t-md transition-[height]"
                      style={{ height: `${Math.max(2, h)}%` }}
                    />
                    <div className="text-[0.65rem] text-fysi-muted uppercase tracking-[0.06em]">
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Distribuição por lane — pizza + barras */}
        <section className="bg-white rounded-[20px] border border-fysi-line p-5 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <Eyebrow>Projetos por status</Eyebrow>
            <span className="text-[0.7rem] text-fysi-muted">
              {GENERAL_LANES.length} estágios · {stats.total} total
            </span>
          </div>
          <div className="grid md:grid-cols-[280px_1fr] gap-6 items-start">
            {/* Pizza */}
            <PieChart lanes={GENERAL_LANES} porLane={stats.porLane} total={stats.total} />

            {/* Barras */}
            <div className="flex flex-col gap-2">
              {GENERAL_LANES.map((lane) => {
                const tone = LANE_TONE_CLASSES[lane.tone];
                const count = stats.porLane.get(lane.id)?.length ?? 0;
                if (count === 0) return null;
                const pct = (count / maxLane) * 100;
                const totalPct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={lane.id} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      <span className="text-[0.7rem] uppercase tracking-[0.06em] text-fysi-deep font-medium truncate">
                        {lane.label}
                      </span>
                    </div>
                    <div className="flex-1 h-5 bg-fysi-cream/50 rounded-md overflow-hidden">
                      <div
                        className={`h-full ${tone.dot} transition-[width]`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <div className="w-20 shrink-0 text-right text-xs text-fysi-deep tabular-nums">
                      <span className="font-semibold">{count}</span>
                      <span className="text-fysi-muted ml-1">
                        ({totalPct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
              {stats.total === 0 ? (
                <p className="text-sm text-fysi-muted italic">Sem clientes ainda.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Distribuição por tipo de projeto */}
        <section className="bg-white rounded-[20px] border border-fysi-line p-5 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <Eyebrow>Tipo de projeto</Eyebrow>
            <span className="text-[0.7rem] text-fysi-muted">
              {tipoEntries.length} categoria(s)
            </span>
          </div>
          {tipoEntries.length === 0 ? (
            <p className="text-sm text-fysi-muted italic">
              Sem clientes ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tipoEntries.map(([tipo, count]) => {
                const label = tipo === "—" ? "Sem tipo definido" : PROJECT_TYPE_LABELS[tipo] ?? tipo;
                const pct = (count / maxTipo) * 100;
                const totalPct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={tipo} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 text-[0.7rem] text-fysi-deep font-medium truncate">
                      {label}
                    </div>
                    <div className="flex-1 h-5 bg-fysi-cream/50 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-fysi-deep transition-[width]"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <div className="w-20 shrink-0 text-right text-xs text-fysi-deep tabular-nums">
                      <span className="font-semibold">{count}</span>
                      <span className="text-fysi-muted ml-1">
                        ({totalPct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Parados */}
        {stats.parados.length > 0 ? (
          <section className="bg-fysi-yellow/20 rounded-[20px] border-2 border-fysi-yellow p-5 mb-6">
            <div className="flex items-baseline justify-between mb-3">
              <Eyebrow>⚠️ Parados há +14 dias</Eyebrow>
              <span className="text-[0.7rem] text-fysi-deep font-medium">
                {stats.parados.length} cliente(s)
              </span>
            </div>
            <div className="space-y-1.5">
              {stats.parados.slice(0, 10).map((c) => {
                const ref = c.last_client_activity_at ?? c.created_at;
                const days = Math.floor(
                  (Date.now() - new Date(ref).getTime()) / 86_400_000
                );
                return (
                  <a
                    key={c.id}
                    href={`/admin/${c.id}${keyParamFirst}`}
                    className="flex items-center justify-between bg-white rounded-md px-3 py-1.5 border border-fysi-yellow/40 hover:border-fysi-deep/40 transition text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-fysi-deep truncate">
                        {c.nome}
                      </span>
                      {c.empresa ? (
                        <>
                          <span className="text-fysi-muted">·</span>
                          <span className="text-fysi-muted truncate">
                            {c.empresa}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <span className="text-fysi-deep font-medium shrink-0 ml-3">
                      {days}d sem atividade
                    </span>
                  </a>
                );
              })}
              {stats.parados.length > 10 ? (
                <p className="text-[0.7rem] text-fysi-muted mt-2">
                  + {stats.parados.length - 10} cliente(s) parado(s) não listados
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </ContentFrame>
    </Shell>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "slate" | "emerald" | "amber";
}) {
  const toneClasses = {
    slate: "bg-white border-fysi-line",
    emerald: "bg-fysi-mint border-fysi-mint-vivid/30",
    amber: "bg-fysi-yellow/20 border-fysi-yellow",
  }[tone];
  return (
    <div className={`rounded-[14px] border p-4 ${toneClasses}`}>
      <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
        {label}
      </div>
      <div className="text-2xl font-bold text-fysi-deep mt-1 tabular-nums">
        {value}
      </div>
      <div className="text-[0.7rem] text-fysi-muted mt-0.5">{sub}</div>
    </div>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Pizza desenhada com conic-gradient — zero dep externa.
 * Cada fatia recebe a cor da lane via raw-hex (mapeamento de tom Tailwind).
 */
function PieChart({
  lanes,
  porLane,
  total,
}: {
  lanes: typeof GENERAL_LANES;
  porLane: Map<string, ClientForLane[]>;
  total: number;
}) {
  const data = lanes
    .map((l) => ({ lane: l, count: porLane.get(l.id)?.length ?? 0 }))
    .filter((d) => d.count > 0);

  if (total === 0 || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-fysi-muted text-sm">
        Sem dados
      </div>
    );
  }

  // Cores HEX por tom (espelha LANE_TONE_CLASSES.dot)
  const TONE_HEX: Record<string, string> = {
    slate: "#94a3b8",
    indigo: "#6366f1",
    yellow: "#facc15",
    pink: "#ec4899",
    violet: "#8b5cf6",
    amber: "#f59e0b",
    red: "#ef4444",
    orange: "#f97316",
    emerald: "#10b981",
    rose: "#f43f5e",
  };

  let acc = 0;
  const segments = data.map((d) => {
    const start = (acc / total) * 360;
    acc += d.count;
    const end = (acc / total) * 360;
    return { ...d, start, end, color: TONE_HEX[d.lane.tone] ?? "#94a3b8" };
  });

  // Monta o conic-gradient
  const gradient = segments
    .map((s) => `${s.color} ${s.start}deg ${s.end}deg`)
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative h-56 w-56 rounded-full shadow-[inset_0_0_0_2px_white]"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={`Pizza de distribuição: ${segments.map((s) => `${s.lane.label} ${s.count}`).join(", ")}`}
      >
        {/* Donut hole */}
        <div className="absolute inset-[22%] rounded-full bg-white flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-fysi-deep tabular-nums">
            {total}
          </div>
          <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
            projetos
          </div>
        </div>
      </div>
      {/* Legenda compacta */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 w-full max-w-xs">
        {segments.map((s) => (
          <div key={s.lane.id} className="flex items-center gap-1.5 text-[0.7rem]">
            <span
              className="h-2 w-2 rounded-sm shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-fysi-deep truncate flex-1">{s.lane.label}</span>
            <span className="text-fysi-muted tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
