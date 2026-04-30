import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  nome: string;
  email: string;
  empresa: string;
  whatsapp: string;
  project_type: string | null;
  status: string;
  briefing_submitted_at: string | null;
  created_at: string;
  clickup_task_id: string | null;
}

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("clients")
    .select(
      "id, nome, email, empresa, whatsapp, project_type, status, briefing_submitted_at, created_at, clickup_task_id"
    )
    .order("created_at", { ascending: false });

  const clients: ClientRow[] = (data as ClientRow[]) ?? [];

  return (
    <Shell tone="cream" sectionLabel="Admin · Briefings">
      <ContentFrame size="xl">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
          <div>
            <Eyebrow>Painel interno</Eyebrow>
            <h1 className="fysi-display text-3xl md:text-4xl mt-2">
              Briefings ativos
            </h1>
            <p className="text-fysi-muted text-sm mt-2">
              Logado como {user.email}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Pill tone="muted">{clients.length} clientes</Pill>
            <Pill tone="mint">
              {clients.filter((c) => c.status === "concluido").length} concluídos
            </Pill>
          </div>
        </header>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3">
            Erro ao carregar clientes: {error.message}
          </p>
        ) : null}

        <div className="bg-white border border-fysi-line rounded-[20px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-fysi-cream/60 text-left text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Criado em</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-fysi-muted"
                  >
                    Ainda nenhum cliente. Compartilhe o link público do briefing.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-fysi-line hover:bg-fysi-cream/40 transition"
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-fysi-deep">
                          {c.nome}
                        </span>
                        <span className="text-xs text-fysi-muted">
                          {c.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-fysi-deep">{c.empresa}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-fysi-muted">
                        {c.project_type ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-5 py-4 text-xs text-fysi-muted">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/${c.id}`}
                        className="text-xs font-medium text-fysi-deep hover:underline"
                      >
                        Ver briefing →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ContentFrame>
    </Shell>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "concluido"
      ? "mint"
      : status === "em-andamento"
        ? "outline"
        : "muted";
  const label =
    status === "concluido"
      ? "Concluído"
      : status === "em-andamento"
        ? "Em andamento"
        : status === "abandonado"
          ? "Abandonado"
          : "Não iniciado";
  return <Pill tone={tone}>{label}</Pill>;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
