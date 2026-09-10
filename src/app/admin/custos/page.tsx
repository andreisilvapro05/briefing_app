import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember, isAdmin } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { SubmitButton, SubmitTextButton } from "@/components/admin/submit-button";
import { Eyebrow } from "@/components/ui/pill";
import {
  CATEGORIAS_CUSTO,
  CATEGORIA_EMOJI,
  CATEGORIA_LABEL,
  competenciaAnterior,
  competenciaAtual,
  competenciaLabel,
  competenciaSeguinte,
  detectarReajustes,
  porCategoria,
  totalCustos,
  type CompanyCost,
} from "@/lib/company-costs";
import {
  addCompanyCostAction,
  deleteCompanyCostAction,
  repetirRecorrentesAction,
} from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

/**
 * Custos da empresa — só o que SAI (salários, ferramentas, anúncios,
 * equipamento). Nada de receita nem margem, de propósito: serve pra fechar
 * o mês sabendo quanto a empresa gastou.
 *
 * Restrito a sócios (isAdmin): o salário de cada um está aqui dentro.
 */
export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; mes?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!isAdmin(member)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const competencia = /^\d{4}-\d{2}$/.test(params.mes ?? "")
    ? (params.mes as string)
    : competenciaAtual();
  const anterior = competenciaAnterior(competencia);

  const service = createSupabaseServiceRoleClient();
  const [{ data: doMes }, { data: doAnterior }] = await Promise.all([
    service
      .from("company_costs")
      .select("*")
      .eq("competencia", competencia)
      .order("valor", { ascending: false }),
    service.from("company_costs").select("*").eq("competencia", anterior),
  ]);

  const custos = (doMes as CompanyCost[] | null) ?? [];
  const custosAnteriores = (doAnterior as CompanyCost[] | null) ?? [];

  const total = totalCustos(custos);
  const totalAnterior = totalCustos(custosAnteriores);
  const variacao = total - totalAnterior;
  const grupos = porCategoria(custos);
  const reajustes = detectarReajustes(custos, custosAnteriores);
  const totalReajuste = reajustes.reduce((s, r) => s + r.diferenca, 0);

  const mesHref = (m: string) =>
    `/admin/custos?mes=${m}${urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""}`;

  const campo =
    "rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40";
  const rotulo =
    "text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium";

  return (
    <AdminShell
      active="custos"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Custos da empresa
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Só o que sai — salários, ferramentas, anúncios, equipamento. Sem
          receita e sem margem: aqui é pra fechar quanto a empresa gastou no
          mês. Visível apenas para os sócios.
        </p>
      </header>

      {/* Navegação por mês */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Link
          href={mesHref(anterior)}
          className="rounded-full border border-fysi-line bg-white px-3 py-1.5 text-sm text-fysi-deep hover:border-fysi-deep/40"
        >
          ← {competenciaLabel(anterior)}
        </Link>
        <span className="text-sm font-semibold text-fysi-deep capitalize">
          {competenciaLabel(competencia)}
        </span>
        <Link
          href={mesHref(competenciaSeguinte(competencia))}
          className="rounded-full border border-fysi-line bg-white px-3 py-1.5 text-sm text-fysi-deep hover:border-fysi-deep/40"
        >
          {competenciaLabel(competenciaSeguinte(competencia))} →
        </Link>
      </div>

      {/* Totais */}
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <div className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5">
          <span className={rotulo}>Total do mês</span>
          <p className="mt-1 text-[1.6rem] font-semibold tabular-nums text-fysi-deep">
            {formatMoney(total)}
          </p>
          <p className="text-xs text-fysi-muted">
            {custos.length} lançamento{custos.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5">
          <span className={rotulo}>Mês anterior</span>
          <p className="mt-1 text-[1.6rem] font-semibold tabular-nums text-fysi-muted">
            {formatMoney(totalAnterior)}
          </p>
          {totalAnterior > 0 ? (
            <p
              className={`text-xs font-medium ${
                variacao > 0 ? "text-red-600" : "text-fysi-green"
              }`}
            >
              {variacao > 0 ? "↑" : "↓"} {formatMoney(Math.abs(variacao))} vs
              este mês
            </p>
          ) : (
            <p className="text-xs text-fysi-muted">sem lançamentos</p>
          )}
        </div>
        <div className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-5">
          <span className={rotulo}>Reajustes detectados</span>
          <p
            className={`mt-1 text-[1.6rem] font-semibold tabular-nums ${
              totalReajuste > 0 ? "text-red-600" : "text-fysi-deep"
            }`}
          >
            {formatMoney(totalReajuste)}
          </p>
          <p className="text-xs text-fysi-muted">
            {reajustes.length === 0
              ? "nada subiu de preço"
              : `${reajustes.length} item${reajustes.length === 1 ? "" : "s"} subiu de preço`}
          </p>
        </div>
      </div>

      {/* Reajuste silencioso — o motivo da tela existir */}
      {reajustes.length > 0 ? (
        <section className="rounded-[16px] border border-amber-200 bg-amber-50 p-5 mb-6">
          <p className="text-sm font-semibold text-amber-900 mb-2">
            ⚠ Subiu de preço desde {competenciaLabel(anterior)}
          </p>
          <ul className="flex flex-col gap-1.5">
            {reajustes.map((r) => (
              <li
                key={r.descricao}
                className="flex flex-wrap items-baseline gap-x-2 text-sm text-amber-900"
              >
                <strong>{r.descricao}</strong>
                <span className="tabular-nums">
                  {formatMoney(r.anterior)} → {formatMoney(r.atual)}
                </span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold tabular-nums">
                  +{formatMoney(r.diferenca)} ({r.percentual.toFixed(1)}%)
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-amber-800">
            Reajuste passa despercebido quando só se olha o total. No ano,
            esses {formatMoney(totalReajuste)} viram{" "}
            {formatMoney(totalReajuste * 12)}.
          </p>
        </section>
      ) : null}

      {/* Lançar custo */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
        <Eyebrow className="mb-3 block">
          Lançar custo em {competenciaLabel(competencia)}
        </Eyebrow>
        <form action={addCompanyCostAction} className="grid gap-3 sm:grid-cols-2">
          {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
          <input type="hidden" name="competencia" value={competencia} />

          <label className="flex flex-col gap-1">
            <span className={rotulo}>O que foi</span>
            <input
              name="descricao"
              required
              placeholder="Ex: Adobe Creative Cloud"
              className={campo}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={rotulo}>Valor (R$)</span>
            <input
              name="valor"
              required
              inputMode="decimal"
              placeholder="380,00"
              className={campo}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={rotulo}>Categoria</span>
            <select name="categoria" defaultValue="ferramentas" className={campo}>
              {CATEGORIAS_CUSTO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={rotulo}>Fornecedor (opcional)</span>
            <input name="fornecedor" placeholder="Ex: Adobe" className={campo} />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={rotulo}>Observação (opcional)</span>
            <input
              name="observacao"
              placeholder="Ex: plano anual, cobrado em setembro"
              className={campo}
            />
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              name="recorrente"
              defaultChecked
              className="h-4 w-4 rounded border-fysi-line"
            />
            <span className="text-sm text-fysi-deep">
              Se repete todo mês
              <span className="text-fysi-muted">
                {" "}
                — é o que permite avisar quando subir de preço
              </span>
            </span>
          </label>

          <div className="sm:col-span-2">
            <SubmitButton size="sm" pendingLabel="Lançando…">
              Lançar custo
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* Lista por categoria */}
      {custos.length === 0 ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-10 text-center">
          <p className="text-fysi-deep font-medium mb-1">
            Nenhum custo lançado em {competenciaLabel(competencia)}
          </p>
          <p className="text-sm text-fysi-muted mb-4 max-w-md mx-auto">
            Lance acima, ou traga de uma vez os custos que se repetem todo mês
            (salários, assinaturas) a partir de {competenciaLabel(anterior)}.
          </p>
          {custosAnteriores.some((c) => c.recorrente) ? (
            <form action={repetirRecorrentesAction} className="inline-block">
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <input type="hidden" name="competencia" value={competencia} />
              <input type="hidden" name="origem" value={anterior} />
              <SubmitButton size="sm" variant="secondary" pendingLabel="Trazendo…">
                Repetir os recorrentes de {competenciaLabel(anterior)}
              </SubmitButton>
            </form>
          ) : null}
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((g) => (
            <section
              key={g.categoria}
              className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card overflow-hidden"
            >
              <header className="flex items-center justify-between gap-3 border-b border-fysi-line bg-fysi-cream/40 px-5 py-3">
                <h2 className="text-sm font-semibold text-fysi-deep">
                  {CATEGORIA_EMOJI[g.categoria]}{" "}
                  {CATEGORIA_LABEL[g.categoria] ?? g.categoria}
                </h2>
                <span className="text-sm font-semibold tabular-nums text-fysi-deep">
                  {formatMoney(g.total)}
                </span>
              </header>
              <ul>
                {g.itens.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-fysi-line px-5 py-3 first:border-t-0"
                  >
                    <span className="font-medium text-fysi-deep">
                      {c.descricao}
                    </span>
                    {c.recorrente ? (
                      <span className="rounded-full bg-fysi-mint/40 px-2 py-0.5 text-[0.65rem] font-medium text-fysi-deep">
                        mensal
                      </span>
                    ) : null}
                    {c.fornecedor ? (
                      <span className="text-xs text-fysi-muted">
                        {c.fornecedor}
                      </span>
                    ) : null}
                    {c.observacao ? (
                      <span className="text-xs text-fysi-muted truncate max-w-[18rem]">
                        {c.observacao}
                      </span>
                    ) : null}
                    <span className="ml-auto font-semibold tabular-nums text-fysi-deep">
                      {formatMoney(Number(c.valor))}
                    </span>
                    <form action={deleteCompanyCostAction}>
                      {urlKey ? (
                        <input type="hidden" name="key" value={urlKey} />
                      ) : null}
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitTextButton
                        danger
                        pendingLabel="…"
                        confirm={`Remover "${c.descricao}" (${formatMoney(
                          Number(c.valor)
                        )})?`}
                      >
                        remover
                      </SubmitTextButton>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {custosAnteriores.some((c) => c.recorrente) ? (
            <form action={repetirRecorrentesAction}>
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <input type="hidden" name="competencia" value={competencia} />
              <input type="hidden" name="origem" value={anterior} />
              <SubmitTextButton pendingLabel="Trazendo…">
                + Trazer recorrentes de {competenciaLabel(anterior)} que faltam
              </SubmitTextButton>
            </form>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
