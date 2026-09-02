import { redirect } from "next/navigation";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Projetos fechados no CRM externo da Fysi — mostra `public.closed_projects`,
 * uma tabela escrita diretamente pelo CRM (não por este app; nenhum código
 * daqui grava nela). Só leitura, focada na parte de pagamento: valor, forma
 * de pagamento e status do contrato de cada projeto fechado.
 */

export const dynamic = "force-dynamic";

interface ClosedProjectRow {
  id: string;
  client_name: string;
  closed_date: string | null;
  plan_name: string | null;
  contract_status: string;
  payment_method: string;
  value: number;
  responsavel: string | null;
  notes: string | null;
  proposal_link: string | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  nao_efetuado: "Não efetuado",
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
};

const PAYMENT_TONES: Record<string, "mint" | "outline" | "muted"> = {
  nao_efetuado: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  negociacao: "Negociação",
  fechado: "Fechado",
};

const STATUS_TONES: Record<string, "mint" | "outline" | "muted"> = {
  negociacao: "outline",
  fechado: "mint",
};

/** Título legível pra valores fora do dicionário — o CRM pode introduzir novos sem quebrar aqui. */
function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default async function ProjetosFechadosPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFinanceAccess(member)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("closed_projects")
    .select(
      "id, client_name, closed_date, plan_name, contract_status, payment_method, value, responsavel, notes, proposal_link"
    )
    .order("closed_date", { ascending: false, nullsFirst: false });

  const rows: ClosedProjectRow[] = (data as ClosedProjectRow[]) ?? [];
  const total = rows.length;
  const valorTotal = rows.reduce((s, r) => s + Number(r.value || 0), 0);
  const pagos = rows.filter((r) => r.payment_method !== "nao_efetuado");
  const valorPago = pagos.reduce((s, r) => s + Number(r.value || 0), 0);

  return (
    <AdminShell active="projetos-fechados" keyParam={keyParam} userEmail={member.email}>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
            Projetos fechados
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Projetos fechados no CRM — só leitura. Os dados vêm direto do
            CRM, não são editáveis aqui.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="muted">{total} no total</Pill>
          <Pill tone="mint">{formatBRL(valorPago)} pago</Pill>
          <Pill tone="outline">{formatBRL(valorTotal - valorPago)} pendente</Pill>
        </div>
      </header>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
          Erro ao carregar projetos fechados: {error.message}
        </p>
      ) : null}

      <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-fysi-cream/60 text-left text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Plano</th>
              <th className="px-5 py-3 font-medium">Valor</th>
              <th className="px-5 py-3 font-medium">Pagamento</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Fechado em</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-fysi-muted">
                  Nenhum projeto fechado ainda. Esta lista é alimentada
                  automaticamente pelo CRM quando um projeto é fechado por lá.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-fysi-line hover:bg-fysi-cream/40 transition"
                >
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-fysi-deep">
                        {r.client_name}
                      </span>
                      {r.responsavel ? (
                        <span className="text-[0.7rem] text-fysi-muted">
                          {r.responsavel}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-fysi-deep">
                    {r.plan_name || "—"}
                  </td>
                  <td className="px-5 py-4 text-fysi-deep tabular-nums">
                    {formatBRL(Number(r.value || 0))}
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={PAYMENT_TONES[r.payment_method] ?? "mint"}>
                      {PAYMENT_LABELS[r.payment_method] ?? humanize(r.payment_method)}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={STATUS_TONES[r.contract_status] ?? "muted"}>
                      {STATUS_LABELS[r.contract_status] ?? humanize(r.contract_status)}
                    </Pill>
                  </td>
                  <td className="px-5 py-4 text-xs text-fysi-muted">
                    {formatDate(r.closed_date)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {r.proposal_link ? (
                      <a
                        href={r.proposal_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-fysi-deep hover:underline"
                      >
                        Proposta →
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[0.7rem] text-fysi-muted mt-4">
        <Eyebrow>Nota</Eyebrow> — esses dados vêm de fora deste app (o CRM
        escreve direto na tabela `closed_projects`); nada aqui edita ou
        confirma pagamentos.
      </p>
    </AdminShell>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
