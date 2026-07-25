import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";
import {
  GENERAL_LANES,
  laneForClient,
  type ClientForLane,
} from "@/lib/workflow-lanes";
import {
  StatusPieBoard,
  type LaneGroup,
} from "@/components/admin/status-pie-board";

export const dynamic = "force-dynamic";

// Cor HEX por tom (espelha LANE_TONE_CLASSES.dot)
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
  const novoHref = `/admin/novo${keyParam}`;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select(
      "id, nome, empresa, project_type, status, current_stage_index, briefing_submitted_at, contrato_preenchido_at, chamada_agendada_at, contrato_status, pagamento_total, pagamento_pago, last_client_activity_at, created_at"
    )
    .order("created_at", { ascending: false });

  const clients = (data as ClientForLane[]) ?? [];

  // Agrupa por lane e monta os grupos serializáveis pro componente client.
  const byLane = new Map<string, ClientForLane[]>();
  GENERAL_LANES.forEach((l) => byLane.set(l.id, []));
  clients.forEach((c) => byLane.get(laneForClient(c))?.push(c));

  const groups: LaneGroup[] = GENERAL_LANES.map((lane) => ({
    id: lane.id,
    label: lane.label,
    color: TONE_HEX[lane.tone] ?? "#94a3b8",
    description: lane.description ?? null,
    clients: (byLane.get(lane.id) ?? []).map((c) => {
      const total = Number(c.pagamento_total) || 0;
      const pago = Number(c.pagamento_pago) || 0;
      return {
        id: c.id,
        nome: c.nome,
        empresa: c.empresa,
        tipo: c.project_type
          ? PROJECT_TYPE_LABELS[c.project_type] ?? c.project_type
          : "—",
        status: c.status || "nao-iniciado",
        pagamento: total > 0 ? `${Math.round((pago / total) * 100)}%` : "—",
      };
    }),
  }));

  return (
    <AdminShell active="lista" keyParam={keyParam} userEmail={user.email}>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
            Projetos por status
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Clique numa fatia da pizza pra ver os projetos daquela etapa. Mude o
            status na linha pra mover o projeto.
          </p>
        </div>
        <Link
          href={novoHref}
          className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
        >
          + Novo projeto
        </Link>
      </header>

      <StatusPieBoard
        groups={groups}
        keyParam={keyParam}
        urlKey={urlKey ?? undefined}
        novoHref={novoHref}
      />
    </AdminShell>
  );
}
