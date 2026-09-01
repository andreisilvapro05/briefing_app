import { redirect } from "next/navigation";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { TemplateUploader } from "@/components/admin/template-uploader";
import { inicioDoPeriodo, type Periodo } from "@/lib/date-periods";
import { PROJECT_TYPE_LABELS } from "@/lib/briefing-labels";

export const dynamic = "force-dynamic";

interface ContractRow {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  contrato_status: string | null;
  contrato_signed_url: string | null;
  contrato_dados: Record<string, unknown> | null;
  autentique_document_id: string;
  project_type: string | null;
  updated_at: string;
}

interface SearchParams {
  key?: string;
  status?: string;
  periodo?: string;
  tipo?: string;
}

const PERIODO_LABELS: Record<string, string> = {
  semana: "Esta semana",
  mes: "Este mês",
};

/** Início do período em ISO, pra filtrar updated_at >= isso. */
function periodoDesde(periodo: string): string | null {
  if (periodo === "semana" || periodo === "mes") {
    return inicioDoPeriodo(periodo as Periodo).toISOString();
  }
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  assinado: "Assinado",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
};

const STATUS_TONES: Record<string, "mint" | "outline" | "muted"> = {
  pendente: "outline",
  assinado: "mint",
  rejeitado: "muted",
  cancelado: "muted",
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFinanceAccess(member)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  // Sempre preserva ?key= se veio na URL (mesmo se cookie também autenticou).
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const visibleIds = await getVisibleClientIds(member);
  const service = createSupabaseServiceRoleClient();

  let contracts: ContractRow[] = [];
  if (!visibleIds || visibleIds.size > 0) {
    let query = service
      .from("clients")
      .select(
        "id, nome, empresa, email, contrato_status, contrato_signed_url, contrato_dados, autentique_document_id, project_type, updated_at"
      )
      .not("autentique_document_id", "is", null)
      .order("updated_at", { ascending: false });

    if (visibleIds) query = query.in("id", Array.from(visibleIds));
    if (params.status) query = query.eq("contrato_status", params.status);
    if (params.tipo) query = query.eq("project_type", params.tipo);
    const desde = params.periodo ? periodoDesde(params.periodo) : null;
    if (desde) query = query.gte("updated_at", desde);

    const { data } = await query;
    contracts = (data as ContractRow[]) ?? [];
  }

  // Metadados do modelo de contrato atual (se já foi subido).
  const { data: tplList } = await service.storage
    .from("contracts-templates")
    .list();
  const modeloAtual = (tplList ?? []).find((f) => f.name === "modelo.docx");

  // Totais (sem filtro de status, mas dentro do que este membro pode ver) só pra header
  let all: { contrato_status: string | null }[] = [];
  if (!visibleIds || visibleIds.size > 0) {
    let allQuery = service
      .from("clients")
      .select("contrato_status")
      .not("autentique_document_id", "is", null);
    if (visibleIds) allQuery = allQuery.in("id", Array.from(visibleIds));
    const { data: allData } = await allQuery;
    all = (allData as { contrato_status: string | null }[] | null) ?? [];
  }
  const total = all.length;
  const pendentes = all.filter((c) => c.contrato_status === "pendente").length;
  const assinados = all.filter((c) => c.contrato_status === "assinado").length;

  return (
    <AdminShell active="contratos" keyParam={keyParam} userEmail={member.email}>
        <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
              Contratos
            </h1>
            <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
              Acompanhe cada contrato — pacote, valor e status — e abra o
              contrato do cliente com um clique.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="muted">{total} no total</Pill>
            <Pill tone="outline">{pendentes} pendentes</Pill>
            <Pill tone="mint">{assinados} assinados</Pill>
          </div>
        </header>

        <TemplateUploader
          urlKey={urlKey ?? undefined}
          currentTemplateUpdatedAt={
            modeloAtual?.updated_at ?? modeloAtual?.created_at ?? undefined
          }
        />

        <div className="bg-white border border-fysi-line rounded-[16px] p-4 mb-6 flex flex-col gap-3">
          <FilterPillRow
            label="Status"
            urlKey={urlKey}
            paramName="status"
            current={params.status ?? ""}
            otherParams={{ periodo: params.periodo, tipo: params.tipo }}
            options={[
              { value: "", label: "Todos" },
              { value: "pendente", label: "Pendente" },
              { value: "assinado", label: "Assinado" },
              { value: "rejeitado", label: "Rejeitado" },
              { value: "cancelado", label: "Cancelado" },
            ]}
          />
          <FilterPillRow
            label="Tipo"
            urlKey={urlKey}
            paramName="tipo"
            current={params.tipo ?? ""}
            otherParams={{ status: params.status, periodo: params.periodo }}
            options={[
              { value: "", label: "Todos" },
              ...Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <FilterPillRow
            label="Período (atualizado)"
            urlKey={urlKey}
            paramName="periodo"
            current={params.periodo ?? ""}
            otherParams={{ status: params.status, tipo: params.tipo }}
            options={[
              { value: "", label: "Todo o período" },
              { value: "semana", label: "Esta semana" },
              { value: "mes", label: "Este mês" },
            ]}
          />
          {params.status || params.periodo || params.tipo ? (
            <Link
              href={`/admin/contratos${keyParam}`}
              className="self-start text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              Limpar filtros
            </Link>
          ) : null}
        </div>

        {params.periodo ? (
          <p className="text-xs text-fysi-muted mb-3">
            {contracts.length} contrato{contracts.length === 1 ? "" : "s"} ·{" "}
            {PERIODO_LABELS[params.periodo] ?? params.periodo}
          </p>
        ) : null}

        <div className="bg-white border border-fysi-line rounded-[20px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-fysi-cream/60 text-left text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Pacote</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Atualizado</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-fysi-muted"
                  >
                    {params.status || params.periodo
                      ? "Nenhum contrato bate com esse filtro."
                      : (
                        <>
                          Nenhum contrato gerado ainda. Vá em{" "}
                          <Link
                            href={`/admin${keyParam}`}
                            className="underline hover:text-fysi-deep"
                          >
                            Clientes
                          </Link>{" "}
                          e gere o primeiro pra um cliente.
                        </>
                      )}
                  </td>
                </tr>
              ) : (
                contracts.map((c) => {
                  const dados = c.contrato_dados ?? {};
                  const pacoteNome =
                    typeof dados.pacote_nome === "string" && dados.pacote_nome
                      ? dados.pacote_nome
                      : "Contrato";
                  const valor =
                    typeof dados.valor_parcelamento === "string" &&
                    dados.valor_parcelamento
                      ? dados.valor_parcelamento
                      : "—";
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-fysi-line hover:bg-fysi-cream/40 transition"
                    >
                      <td className="px-5 py-4">
                        <span className="font-medium text-fysi-deep">
                          {pacoteNome}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="block max-w-[14rem] truncate text-fysi-deep"
                          title={valor}
                        >
                          {valor}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {c.contrato_status ? (
                          <Pill
                            tone={STATUS_TONES[c.contrato_status] ?? "muted"}
                          >
                            {STATUS_LABELS[c.contrato_status] ??
                              c.contrato_status}
                          </Pill>
                        ) : (
                          <span className="text-xs text-fysi-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-fysi-muted">
                            {c.empresa || c.nome}
                          </span>
                          <span className="text-[0.7rem] text-fysi-muted/80">
                            {c.email ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-fysi-muted">
                        {formatDate(c.updated_at)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/${c.id}?tab=contrato${
                            keyParam ? `&${keyParam.slice(1)}` : ""
                          }`}
                          className="text-xs font-medium text-fysi-deep hover:underline"
                        >
                          Abrir contrato →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
    </AdminShell>
  );
}

/**
 * Linha de filtro em pill — clica e já aplica (sem botão "Filtrar" separado).
 * Preserva os OUTROS filtros ativos + ?key= ao trocar de opção.
 */
function FilterPillRow({
  label,
  urlKey,
  paramName,
  current,
  otherParams,
  options,
}: {
  label: string;
  urlKey: string | null;
  paramName: string;
  current: string;
  otherParams: Record<string, string | undefined>;
  options: { value: string; label: string }[];
}) {
  function href(value: string) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(otherParams)) {
      if (v) sp.set(k, v);
    }
    if (value) sp.set(paramName, value);
    if (urlKey) sp.set("key", urlKey);
    const qs = sp.toString();
    return `/admin/contratos${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-fysi-muted uppercase tracking-[0.1em] w-full sm:w-auto sm:min-w-[9rem]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = current === opt.value;
          return (
            <Link
              key={opt.value || "todos"}
              href={href(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-fysi-deep text-fysi-cream border-fysi-deep"
                  : "bg-white text-fysi-deep border-fysi-line hover:border-fysi-deep/40"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
