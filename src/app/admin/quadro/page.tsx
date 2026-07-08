import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";
import {
  GENERAL_LANES,
  LANE_TONE_CLASSES,
  laneForClient,
  type ClientForLane,
} from "@/lib/workflow-lanes";

export const dynamic = "force-dynamic";

interface SearchParams {
  key?: string;
  tipo?: string;
}

export default async function AdminQuadroPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const tipoFilter = params.tipo ?? "";

  const service = createSupabaseServiceRoleClient();
  let query = service
    .from("clients")
    .select(
      "id, nome, empresa, project_type, status, current_stage_index, briefing_submitted_at, contrato_preenchido_at, chamada_agendada_at, contrato_status, pagamento_total, pagamento_pago, last_client_activity_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (tipoFilter) query = query.eq("project_type", tipoFilter);

  const { data } = await query;
  const clients = (data as ClientForLane[]) ?? [];

  // Agrupa por lane
  const byLane = new Map<string, ClientForLane[]>();
  GENERAL_LANES.forEach((l) => byLane.set(l.id, []));
  clients.forEach((c) => byLane.get(laneForClient(c))?.push(c));

  return (
    <Shell tone="cream" sectionLabel="Admin · Quadro">
      <ContentFrame size="xl">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <AdminSidebar active="quadro" keyParam={keyParamFirst} />
          <div className="flex-1 min-w-0 w-full">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <Eyebrow>Painel interno</Eyebrow>
            <h1 className="fysi-display text-3xl md:text-4xl mt-2">Quadro</h1>
            <p className="text-fysi-muted text-sm mt-2">
              Acompanhamento visual de todos os clientes pelo estágio do fluxo
              comercial e de produção.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="muted">{clients.length} clientes</Pill>
          </div>
        </header>

        {/* Filtro por tipo */}
        <form
          method="get"
          className="flex flex-wrap items-center gap-2 mb-5"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <select
            name="tipo"
            defaultValue={tipoFilter}
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-1.5 text-xs text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(PROJECT_TYPE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-1.5 hover:bg-fysi-deep/90"
          >
            Filtrar
          </button>
          {tipoFilter ? (
            <Link
              href={`/admin/quadro${keyParamFirst}`}
              className="text-xs text-fysi-muted hover:text-fysi-deep underline"
            >
              Limpar
            </Link>
          ) : null}
        </form>

        {/* Resumo em chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {GENERAL_LANES.map((lane) => {
            const tone = LANE_TONE_CLASSES[lane.tone];
            const count = byLane.get(lane.id)?.length ?? 0;
            if (count === 0) return null;
            return (
              <span
                key={lane.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${tone.bg} ${tone.border} ${tone.text} text-[0.7rem] font-medium`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                {lane.label} · {count}
              </span>
            );
          })}
        </div>

        {/* Kanban scroll horizontal */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3 min-w-fit">
            {GENERAL_LANES.map((lane) => {
              const tone = LANE_TONE_CLASSES[lane.tone];
              const items = byLane.get(lane.id) ?? [];
              return (
                <div
                  key={lane.id}
                  className={`flex flex-col w-72 shrink-0 rounded-[16px] border ${tone.border} ${tone.bg}`}
                >
                  <div className={`px-3 py-2.5 border-b ${tone.border}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${tone.dot}`} />
                        <span
                          className={`text-[0.7rem] uppercase tracking-[0.08em] font-semibold truncate ${tone.text}`}
                        >
                          {lane.label}
                        </span>
                      </div>
                      <span className={`text-[0.7rem] font-medium ${tone.text}`}>
                        {items.length}
                      </span>
                    </div>
                    {lane.description ? (
                      <p className="text-[0.65rem] text-fysi-muted mt-0.5 leading-snug">
                        {lane.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                    {items.map((c) => (
                      <ClientCard
                        key={c.id}
                        client={c}
                        keyParam={keyParamFirst}
                      />
                    ))}
                    {items.length === 0 ? (
                      <div className="text-[0.7rem] text-fysi-muted italic text-center py-6">
                        —
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </div>
        </div>
      </ContentFrame>
    </Shell>
  );
}

function ClientCard({
  client,
  keyParam,
}: {
  client: ClientForLane;
  keyParam: string;
}) {
  const total = Number(client.pagamento_total ?? 0);
  const pago = Number(client.pagamento_pago ?? 0);
  const ref = client.last_client_activity_at ?? client.created_at;
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
  const tipo = client.project_type
    ? PROJECT_TYPE_LABELS[client.project_type] ?? client.project_type
    : null;

  return (
    <Link
      href={`/admin/${client.id}${keyParam}`}
      className="block bg-white rounded-[10px] border border-fysi-line p-2.5 hover:border-fysi-deep/40 transition group"
    >
      <div className="text-sm font-medium text-fysi-deep truncate">
        {client.nome}
      </div>
      {client.empresa && client.empresa !== client.nome ? (
        <div className="text-[0.7rem] text-fysi-muted truncate">
          {client.empresa}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 mt-2">
        {tipo ? (
          <span className="text-[0.6rem] uppercase tracking-[0.06em] text-fysi-muted truncate">
            {tipo}
          </span>
        ) : (
          <span className="text-[0.6rem] uppercase tracking-[0.06em] text-fysi-muted/60">
            sem tipo
          </span>
        )}
        <span className="text-[0.65rem] text-fysi-muted shrink-0">
          {days === 0 ? "hoje" : `${days}d`}
        </span>
      </div>

      {total > 0 ? (
        <div className="mt-1.5">
          <div className="flex items-center justify-between text-[0.65rem]">
            <span className="text-fysi-muted">Pago</span>
            <span className="text-fysi-deep font-medium tabular-nums">
              {formatBRL(pago)} / {formatBRL(total)}
            </span>
          </div>
          <div className="h-0.5 mt-0.5 bg-fysi-line/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-fysi-deep"
              style={{
                width: `${Math.min(100, total > 0 ? (pago / total) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </Link>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
