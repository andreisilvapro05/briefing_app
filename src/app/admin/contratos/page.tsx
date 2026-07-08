import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { TemplateUploader } from "@/components/admin/template-uploader";

export const dynamic = "force-dynamic";

interface ContractRow {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  contrato_status: string | null;
  contrato_signed_url: string | null;
  autentique_document_id: string;
  updated_at: string;
}

interface SearchParams {
  key?: string;
  status?: string;
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
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  // Sempre preserva ?key= se veio na URL (mesmo se cookie também autenticou).
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();
  let query = service
    .from("clients")
    .select(
      "id, nome, empresa, email, contrato_status, contrato_signed_url, autentique_document_id, updated_at"
    )
    .not("autentique_document_id", "is", null)
    .order("updated_at", { ascending: false });

  if (params.status) query = query.eq("contrato_status", params.status);

  const { data } = await query;
  const contracts: ContractRow[] = (data as ContractRow[]) ?? [];

  // Metadados do modelo de contrato atual (se já foi subido).
  const { data: tplList } = await service.storage
    .from("contracts-templates")
    .list();
  const modeloAtual = (tplList ?? []).find((f) => f.name === "modelo.docx");

  // Totais (sem filtro de status) só pra header
  const { data: allData } = await service
    .from("clients")
    .select("contrato_status")
    .not("autentique_document_id", "is", null);
  const all = (allData as { contrato_status: string | null }[] | null) ?? [];
  const total = all.length;
  const pendentes = all.filter((c) => c.contrato_status === "pendente").length;
  const assinados = all.filter((c) => c.contrato_status === "assinado").length;

  return (
    <Shell tone="cream" sectionLabel="Admin · Contratos">
      <ContentFrame size="xl">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <AdminSidebar active="contratos" keyParam={keyParam} />
          <div className="flex-1 min-w-0 w-full">
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <Eyebrow>Painel interno</Eyebrow>
              <h1 className="fysi-display text-3xl md:text-4xl mt-2">
                Contratos
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
              <Pill tone="muted">{total} no total</Pill>
              <Pill tone="outline">{pendentes} pendentes</Pill>
              <Pill tone="mint">{assinados} assinados</Pill>
            </div>
          </div>
        </header>

        <TemplateUploader
          urlKey={urlKey ?? undefined}
          currentTemplateUpdatedAt={
            modeloAtual?.updated_at ?? modeloAtual?.created_at ?? undefined
          }
        />

        <form
          method="get"
          className="bg-white border border-fysi-line rounded-[16px] p-4 mb-6 flex flex-wrap items-end gap-3"
        >
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-fysi-muted uppercase tracking-[0.1em]">
              Status
            </label>
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep"
            >
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="assinado">Assinado</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
          >
            Filtrar
          </button>
          {params.status ? (
            <Link
              href={`/admin/contratos${keyParam}`}
              className="rounded-full border border-fysi-line text-sm text-fysi-muted px-3 py-2 hover:text-fysi-deep hover:border-fysi-deep/30"
            >
              Limpar
            </Link>
          ) : null}
        </form>

        <div className="bg-white border border-fysi-line rounded-[20px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-fysi-cream/60 text-left text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Atualizado</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-fysi-muted"
                  >
                    {params.status
                      ? "Nenhum contrato com esse status."
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
                contracts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-fysi-line hover:bg-fysi-cream/40 transition"
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-fysi-deep">
                          {c.empresa || c.nome}
                        </span>
                        <span className="text-xs text-fysi-muted">
                          {c.nome} · {c.email ?? "—"}
                        </span>
                      </div>
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
                    <td className="px-5 py-4 text-xs text-fysi-muted">
                      {formatDate(c.updated_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/${c.id}${keyParam}`}
                        className="text-xs font-medium text-fysi-deep hover:underline"
                      >
                        Ver cliente →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </div>
        </div>
      </ContentFrame>
    </Shell>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
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
