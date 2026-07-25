import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";
import {
  GENERAL_LANES,
  LANE_TONE_CLASSES,
  laneForClient,
  type ClientForLane,
} from "@/lib/workflow-lanes";

export const dynamic = "force-dynamic";

export default async function AdminListaPage({
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
  const { data } = await service
    .from("clients")
    .select(
      "id, nome, empresa, project_type, status, current_stage_index, briefing_submitted_at, contrato_preenchido_at, chamada_agendada_at, contrato_status, pagamento_total, pagamento_pago, last_client_activity_at, created_at"
    )
    .order("created_at", { ascending: false });

  const clients = (data as ClientForLane[]) ?? [];

  // Agrupa por lane
  const porLane = new Map<string, ClientForLane[]>();
  GENERAL_LANES.forEach((l) => porLane.set(l.id, []));
  clients.forEach((c) => {
    const lane = laneForClient(c);
    porLane.get(lane)?.push(c);
  });

  const total = clients.length;

  return (
    <AdminShell active="lista" keyParam={keyParam} userEmail={user.email}>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
          Projetos por status
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Visão em lista dos projetos, agrupados pela etapa atual do fluxo.
        </p>
      </header>

      {/* Pizza — Projetos por status */}
      <section className="bg-white border border-fysi-line rounded-[16px] p-5 mb-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[0.7rem] uppercase tracking-[0.14em] text-fysi-muted font-semibold">
            Projetos por status
          </h2>
          <span className="text-[0.7rem] text-fysi-muted">{total} total</span>
        </div>
        <PieChart lanes={GENERAL_LANES} porLane={porLane} total={total} />
      </section>

      {/* Lista agrupada por status */}
      <section className="flex flex-col gap-4">
        {total === 0 ? (
          <div className="bg-white border border-fysi-line rounded-[16px] p-5 text-sm text-fysi-muted italic">
            Sem clientes ainda.
          </div>
        ) : null}

        {GENERAL_LANES.map((lane) => {
          const list = porLane.get(lane.id) ?? [];
          if (list.length === 0) return null;
          const tone = LANE_TONE_CLASSES[lane.tone];
          return (
            <details
              key={lane.id}
              open
              className="bg-white border border-fysi-line rounded-[16px] overflow-hidden"
            >
              <summary className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none list-none">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${tone.bg} ${tone.border} ${tone.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {lane.label}
                </span>
                <span className="text-sm font-semibold text-fysi-deep tabular-nums">
                  {list.length}
                </span>
                {lane.description ? (
                  <span className="text-[0.72rem] text-fysi-muted truncate hidden md:inline">
                    {lane.description}
                  </span>
                ) : null}
                <span className="ml-auto text-fysi-muted text-xs">▾</span>
              </summary>

              <div className="border-t border-fysi-line">
                {/* Cabeçalho da tabela */}
                <div className="hidden md:grid grid-cols-[1fr_160px_140px_100px_64px] gap-3 px-5 py-2 bg-fysi-cream/40 text-[0.62rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  <span>Cliente</span>
                  <span>Tipo</span>
                  <span>Status</span>
                  <span>Pagamento</span>
                  <span className="text-right">Ação</span>
                </div>

                {list.map((c) => {
                  const nome = c.empresa || c.nome;
                  const tipoLabel = c.project_type
                    ? PROJECT_TYPE_LABELS[c.project_type] ?? c.project_type
                    : "—";
                  const pagTotal = Number(c.pagamento_total) || 0;
                  const pago = Number(c.pagamento_pago) || 0;
                  const pagamento =
                    pagTotal > 0
                      ? `${Math.round((pago / pagTotal) * 100)}%`
                      : "—";
                  return (
                    <div
                      key={c.id}
                      className="grid grid-cols-2 md:grid-cols-[1fr_160px_140px_100px_64px] gap-x-3 gap-y-1 px-5 py-3 border-t border-fysi-line/70 items-center text-sm"
                    >
                      <span className="font-medium text-fysi-deep truncate col-span-2 md:col-span-1">
                        {nome}
                      </span>
                      <span className="text-fysi-muted truncate">{tipoLabel}</span>
                      <span className="text-fysi-muted truncate">
                        {c.status || "—"}
                      </span>
                      <span className="text-fysi-deep tabular-nums">{pagamento}</span>
                      <a
                        href={`/admin/${c.id}${keyParam}`}
                        className="text-right text-fysi-deep font-medium hover:underline shrink-0"
                      >
                        Ver →
                      </a>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </section>
    </AdminShell>
  );
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

  const segments: (typeof data[number] & {
    start: number;
    end: number;
    color: string;
  })[] = [];
  let running = 0;
  for (const d of data) {
    const start = (running / total) * 360;
    running += d.count;
    const end = (running / total) * 360;
    segments.push({
      ...d,
      start,
      end,
      color: TONE_HEX[d.lane.tone] ?? "#94a3b8",
    });
  }

  // Monta o conic-gradient
  const gradient = segments
    .map((s) => `${s.color} ${s.start}deg ${s.end}deg`)
    .join(", ");

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-6 items-center">
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
      </div>
      {/* Legenda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.map((s) => {
          const pct = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <div key={s.lane.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-fysi-deep truncate flex-1">{s.lane.label}</span>
              <span className="text-fysi-muted tabular-nums shrink-0">
                {s.count} ({pct.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
