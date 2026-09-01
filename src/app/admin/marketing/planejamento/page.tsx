import { redirect } from "next/navigation";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  createPlanoItemAction,
  setPlanoItemStatusAction,
  deletePlanoItemAction,
} from "../actions";

export const dynamic = "force-dynamic";

interface PlanoRow {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "planejado" | "em-andamento" | "feito";
}

const STATUS_LABELS: Record<PlanoRow["status"], string> = {
  planejado: "Planejado",
  "em-andamento": "Em andamento",
  feito: "Feito",
};

const STATUS_TONE: Record<PlanoRow["status"], string> = {
  planejado: "bg-fysi-deep/[0.05] text-fysi-muted border-fysi-line",
  "em-andamento": "bg-fysi-yellow/30 text-amber-800 border-fysi-yellow",
  feito: "bg-fysi-mint text-fysi-deep border-fysi-mint-vivid/40",
};

function formatMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m) return mes;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  });
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MarketingPlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; mes?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const mes = params.mes || currentMonth();

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("marketing_plano_itens")
    .select("id, titulo, descricao, status")
    .eq("mes_referencia", mes)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  const itens = (data as PlanoRow[]) ?? [];

  const monthHref = (m: string) =>
    `/admin/marketing/planejamento?mes=${m}${urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""}`;

  return (
    <AdminShell
      active="marketing-planejamento"
      keyParam={keyParam}
      userEmail={member.email}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
          Planejamento
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          O que está planejado pra cada mês — campanhas, ações, entregas de
          marketing e comercial.
        </p>
      </header>

      <div className="flex items-center gap-2 mb-6">
        <Link
          href={monthHref(shiftMonth(mes, -1))}
          className="w-8 h-8 grid place-items-center rounded-full border border-fysi-line text-fysi-muted hover:text-fysi-deep hover:border-fysi-deep/40"
          aria-label="Mês anterior"
        >
          ‹
        </Link>
        <span className="text-sm font-medium text-fysi-deep capitalize min-w-[10rem] text-center">
          {formatMes(mes)}
        </span>
        <Link
          href={monthHref(shiftMonth(mes, 1))}
          className="w-8 h-8 grid place-items-center rounded-full border border-fysi-line text-fysi-muted hover:text-fysi-deep hover:border-fysi-deep/40"
          aria-label="Próximo mês"
        >
          ›
        </Link>
        {mes !== currentMonth() ? (
          <Link
            href={monthHref(currentMonth())}
            className="text-xs text-fysi-deep hover:underline ml-1"
          >
            Voltar pro mês atual
          </Link>
        ) : null}
      </div>

      <form
        action={createPlanoItemAction}
        className="bg-white border border-fysi-line rounded-[16px] p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
        <input type="hidden" name="mesReferencia" value={mes} />
        <div className="flex-1 min-w-0">
          <Input label="Novo item" name="titulo" required placeholder="Ex: Campanha de tráfego pago" />
        </div>
        <div className="flex-1 min-w-0">
          <Textarea label="Descrição (opcional)" name="descricao" rows={1} />
        </div>
        <SubmitButton size="md" pendingLabel="Adicionando…">
          + Adicionar
        </SubmitButton>
      </form>

      {itens.length === 0 ? (
        <p className="text-sm text-fysi-muted bg-white border border-fysi-line rounded-[16px] p-8 text-center">
          Nada planejado pra {formatMes(mes)} ainda.
        </p>
      ) : (
        <div className="bg-white border border-fysi-line rounded-[20px] overflow-hidden">
          <ul className="divide-y divide-fysi-line">
            {itens.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fysi-deep">{item.titulo}</p>
                  {item.descricao ? (
                    <p className="text-xs text-fysi-muted mt-0.5">{item.descricao}</p>
                  ) : null}
                </div>
                <form action={setPlanoItemStatusAction} className="shrink-0">
                  {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                  <input type="hidden" name="id" value={item.id} />
                  <AutoSubmitSelect
                    name="status"
                    defaultValue={item.status}
                    className={`rounded-full border text-xs font-medium px-3 py-1 cursor-pointer focus:outline-none ${STATUS_TONE[item.status]}`}
                  >
                    {(Object.keys(STATUS_LABELS) as PlanoRow["status"][]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </AutoSubmitSelect>
                </form>
                <form action={deletePlanoItemAction} className="shrink-0">
                  {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                  <input type="hidden" name="id" value={item.id} />
                  <DeleteButton />
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminShell>
  );
}
