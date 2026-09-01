import { redirect } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/pill";
import { SubmitButton } from "@/components/admin/submit-button";
import { Input } from "@/components/ui/input";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { GoalProgressInput } from "@/components/admin/goal-progress-input";
import { DeleteButton } from "@/components/admin/delete-button";
import { createGoalAction, deleteGoalAction } from "../actions";

export const dynamic = "force-dynamic";

interface GoalRow {
  id: string;
  titulo: string;
  meta: number;
  atual: number;
  unidade: string | null;
  mes_referencia: string;
}

/** "2026-09" → "Setembro 2026". */
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

export default async function MarketingMetasPage({
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
    .from("marketing_goals")
    .select("id, titulo, meta, atual, unidade, mes_referencia")
    .eq("mes_referencia", mes)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  const goals = (data as GoalRow[]) ?? [];

  const monthHref = (m: string) =>
    `/admin/marketing/metas?mes=${m}${urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""}`;

  return (
    <AdminShell
      active="marketing-metas"
      keyParam={keyParam}
      userEmail={member.email}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fysi-deep">
          Metas &amp; Indicadores
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Acompanhe os números que importam mês a mês. Adicione quantas
          metas quiser — cada uma com seu próprio alvo e unidade.
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
        action={createGoalAction}
        className="bg-white border border-fysi-line rounded-[16px] p-4 mb-6 grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end"
      >
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
        <input type="hidden" name="mesReferencia" value={mes} />
        <Input label="Nova meta" name="titulo" required placeholder="Ex: Novos clientes fechados" />
        <Input label="Alvo" name="meta" required type="text" inputMode="decimal" placeholder="10" className="w-24" />
        <Input label="Unidade" name="unidade" placeholder="clientes, R$, %..." className="w-32" />
        <SubmitButton size="md" pendingLabel="Adicionando…">
          + Adicionar
        </SubmitButton>
      </form>

      {goals.length === 0 ? (
        <p className="text-sm text-fysi-muted bg-white border border-fysi-line rounded-[16px] p-8 text-center">
          Nenhuma meta cadastrada pra {formatMes(mes)} ainda.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {goals.map((g) => {
            const pct = g.meta > 0 ? Math.min(100, Math.round((g.atual / g.meta) * 100)) : 0;
            return (
              <div
                key={g.id}
                className="bg-white border border-fysi-line rounded-[16px] p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-fysi-deep leading-snug">
                    {g.titulo}
                  </h3>
                  <form action={deleteGoalAction}>
                    {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                    <input type="hidden" name="id" value={g.id} />
                    <DeleteButton />
                  </form>
                </div>

                <div className="h-1.5 w-full rounded-full bg-fysi-line overflow-hidden">
                  <div
                    className="h-full bg-fysi-deep transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <GoalProgressInput
                    goalId={g.id}
                    atual={g.atual}
                    unidade={g.unidade}
                    urlKey={urlKey}
                  />
                  <span className="text-xs text-fysi-muted whitespace-nowrap">
                    meta: {g.meta}
                    {g.unidade ? ` ${g.unidade}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
