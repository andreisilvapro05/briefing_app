import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  PROJECT_TYPE_LABELS,
} from "@/lib/briefing-labels";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { DeleteClientRowButton } from "@/components/admin/delete-client-row-button";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  nome: string;
  email: string;
  empresa: string;
  whatsapp: string;
  project_type: string | null;
  status: string;
  current_stage_index: number | null;
  briefing_submitted_at: string | null;
  created_at: string;
  updated_at: string;
  last_client_activity_at: string | null;
  clickup_task_id: string | null;
}

interface SearchParams {
  q?: string;
  status?: string;
  tipo?: string;
  key?: string;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const q = (params.q ?? "").trim();
  const statusFilter = params.status ?? "";
  const tipoFilter = params.tipo ?? "";

  // Sempre que veio com ?key= na URL, preserva nos links internos —
  // mesmo se o cookie tiver autenticado (cookie pode cair no próximo clique).
  // Garante navegação confiável em navegadores que descartam cookie.
  const keyParam = urlKey ? `&key=${encodeURIComponent(urlKey)}` : "";
  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();
  let query = service
    .from("clients")
    .select(
      "id, nome, email, empresa, whatsapp, project_type, status, current_stage_index, briefing_submitted_at, created_at, updated_at, last_client_activity_at, clickup_task_id"
    )
    .order("created_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  if (tipoFilter) query = query.eq("project_type", tipoFilter);
  if (q) {
    // Busca por nome, e-mail ou empresa (case-insensitive)
    query = query.or(
      `nome.ilike.%${q}%,email.ilike.%${q}%,empresa.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  const clients: ClientRow[] = (data as ClientRow[]) ?? [];

  // Conta totais (sem filtros) só pra header
  const { data: totalsData } = await service
    .from("clients")
    .select("status", { count: "exact" });
  const totals = (totalsData as { status: string }[] | null) ?? [];
  const totalCount = totals.length;
  const concluidoCount = totals.filter((c) => c.status === "concluido").length;
  const emAndamentoCount = totals.filter(
    (c) => c.status === "em-andamento"
  ).length;

  // Indicador de "parado": cliente em-andamento sem atividade há > 7 dias
  const STUCK_DAYS = 7;
  const now = Date.now();
  function daysSince(iso: string | null): number {
    if (!iso) return 0;
    return Math.floor((now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  }
  function isStuck(c: ClientRow): boolean {
    if (c.status !== "em-andamento") return false;
    return daysSince(c.last_client_activity_at ?? c.created_at) >= STUCK_DAYS;
  }

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
              Logado como {user.email}{" "}
              <Link
                href="/api/auth/admin-logout"
                className="ml-2 underline hover:text-fysi-deep"
              >
                sair
              </Link>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="muted">{totalCount} no total</Pill>
            <Pill tone="outline">{emAndamentoCount} em andamento</Pill>
            <Pill tone="mint">{concluidoCount} concluídos</Pill>
            <Link
              href={`/admin/novo${keyParamFirst}`}
              className="ml-2 inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
            >
              + Novo cliente
            </Link>
          </div>
        </header>

        <AdminTabs active="clientes" keyParam={keyParamFirst} />

        {/* Filtros */}
        <form
          method="get"
          className="bg-white border border-fysi-line rounded-[16px] p-4 mb-6 grid sm:grid-cols-[1fr_auto_auto_auto] gap-3"
        >
          {/* Preserva ?key= entre filtros se for esse o método de auth */}
          {user.source === "url-key" && urlKey ? (
            <input type="hidden" name="key" value={urlKey} />
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, e-mail ou empresa…"
            className="rounded-[10px] border border-fysi-line bg-fysi-cream/40 px-3 py-2 text-sm text-fysi-deep placeholder:text-fysi-muted focus:outline-none focus:border-fysi-deep/40"
          />

          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          >
            <option value="">Todos status</option>
            <option value="em-andamento">Em andamento</option>
            <option value="concluido">Concluído</option>
            <option value="abandonado">Abandonado</option>
            <option value="nao-iniciado">Não iniciado</option>
          </select>

          <select
            name="tipo"
            defaultValue={tipoFilter}
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          >
            <option value="">Todos tipos</option>
            <option value="landing-com-copy">Landing com copy</option>
            <option value="landing-sem-copy">Landing sem copy</option>
            <option value="site-completo">Site completo</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
            >
              Filtrar
            </button>
            {(q || statusFilter || tipoFilter) && (
              <Link
                href="/admin"
                className="rounded-full border border-fysi-line text-sm text-fysi-muted px-3 py-2 hover:text-fysi-deep hover:border-fysi-deep/30"
              >
                Limpar
              </Link>
            )}
          </div>
        </form>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
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
                <th className="px-5 py-3 font-medium">Atividade</th>
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
                    {q || statusFilter || tipoFilter
                      ? "Nenhum cliente bate com os filtros."
                      : "Ainda nenhum cliente. Compartilhe o link público do briefing."}
                  </td>
                </tr>
              ) : (
                clients.map((c) => {
                  const stuck = isStuck(c);
                  const lastActivity = c.last_client_activity_at ?? c.created_at;
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-fysi-line hover:bg-fysi-cream/40 transition"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-fysi-deep">
                              {c.nome}
                            </span>
                            <span className="text-xs text-fysi-muted">
                              {c.email}
                            </span>
                          </div>
                          {stuck ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.1em] text-amber-700 font-medium"
                              title={`Sem atividade há ${daysSince(lastActivity)} dias`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Parado
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-fysi-deep">{c.empresa}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-fysi-muted">
                          {c.project_type
                            ? PROJECT_TYPE_LABELS[c.project_type] ??
                              c.project_type
                            : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="px-5 py-4 text-xs text-fysi-muted">
                        <div className="flex flex-col">
                          <span>{relativeTime(lastActivity)}</span>
                          <span className="text-[0.65rem] opacity-70">
                            criado {formatDate(c.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/${c.id}${keyParamFirst}`}
                            className="text-xs font-medium text-fysi-deep hover:underline"
                          >
                            Ver briefing →
                          </Link>
                          <DeleteClientRowButton
                            clientId={c.id}
                            clientName={c.nome}
                            urlKey={
                              user.source === "url-key" && urlKey
                                ? urlKey
                                : undefined
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-fysi-muted mt-4">
          Mostrando {clients.length} de {totalCount} clientes. Marca de
          &ldquo;Parado&rdquo; aparece após {STUCK_DAYS} dias sem atividade.
        </p>
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

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffSec = Math.floor((Date.now() - then) / 1000);
    if (diffSec < 60) return "agora há pouco";
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `há ${min} min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `há ${hr}h`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
    if (d < 30) return `há ${Math.floor(d / 7)} sem`;
    return `há ${Math.floor(d / 30)} meses`;
  } catch {
    return iso;
  }
}
