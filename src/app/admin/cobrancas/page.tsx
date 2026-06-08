import { redirect } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/admin/admin-tabs";
import {
  formatBRL,
  mesRef,
  statsCobrancas,
  statusDoMes,
  type CobrancaMensal,
} from "@/lib/cobrancas-mensais";
import {
  addCobrancaAction,
  deleteCobrancaAction,
  marcarPagoEsteMesAction,
  registrarPagamentoAction,
  updateCobrancaAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function CobrancasPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; status?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const filtro = params.status ?? "todas";

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("cobrancas_mensais")
    .select("*")
    .order("ativa", { ascending: false })
    .order("dia_cobranca", { ascending: true });

  const todas = (data ?? []) as CobrancaMensal[];
  const stats = statsCobrancas(todas);
  const refAtual = mesRef(new Date());

  let lista = todas;
  if (filtro === "ativas") lista = todas.filter((c) => c.ativa);
  else if (filtro === "atrasados")
    lista = todas.filter(
      (c) => c.ativa && statusDoMes(c) === "atrasado"
    );
  else if (filtro === "a_cobrar")
    lista = todas.filter(
      (c) => c.ativa && statusDoMes(c) === "a_cobrar"
    );
  else if (filtro === "pagos")
    lista = todas.filter((c) => c.ativa && statusDoMes(c) === "pago");
  else if (filtro === "inativas") lista = todas.filter((c) => !c.ativa);

  return (
    <Shell tone="cream" sectionLabel="Admin · Cobranças mensais">
      <ContentFrame size="xl">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <Eyebrow>Painel interno</Eyebrow>
            <h1 className="fysi-display text-3xl md:text-4xl mt-2">
              Cobranças mensais
            </h1>
            <p className="text-fysi-muted text-sm mt-2">
              Clientes recorrentes (SEO, manutenção, hosting). Acompanha o que
              já foi pago no mês e o que ainda falta.
            </p>
          </div>
          <Pill tone="mint">{formatBRL(stats.mrr)} / mês</Pill>
        </header>

        <AdminTabs active="cobrancas" keyParam={keyParamFirst} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi
            label="MRR (receita mensal)"
            value={formatBRL(stats.mrr)}
            sub={`${stats.ativas} ativas`}
            tone="mint"
          />
          <Kpi
            label="Recebido este mês"
            value={formatBRL(stats.recebidoEsteMes)}
            sub={`${stats.pagos.length} cobranças quitadas`}
          />
          <Kpi
            label="A receber"
            value={formatBRL(stats.aReceberEsteMes)}
            sub={`${stats.aCobrar.length + stats.atrasados.length} pendentes`}
            tone={stats.atrasados.length > 0 ? "amber" : "slate"}
          />
          <Kpi
            label="Em atraso"
            value={String(stats.atrasados.length)}
            sub={
              stats.atrasados.length > 0
                ? "passou do dia de cobrança"
                : "tudo em dia"
            }
            tone={stats.atrasados.length > 0 ? "amber" : "mint"}
          />
        </div>

        {/* Form adicionar — collapse */}
        <details className="mb-6 bg-white border border-fysi-line rounded-[16px]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-fysi-deep select-none">
            ➕ Adicionar cobrança
          </summary>
          <form
            action={addCobrancaAction}
            className="p-4 border-t border-fysi-line grid sm:grid-cols-2 gap-3"
          >
            {urlKey ? (
              <input type="hidden" name="key" value={urlKey} />
            ) : null}

            <FieldLabel label="Tipo *" colSpan={2}>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value="mensal"
                    defaultChecked
                  />
                  <span>🔁 Mensal (recorrente)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer ml-4">
                  <input type="radio" name="tipo" value="pontual" />
                  <span>📌 Pontual (uma vez)</span>
                </label>
              </div>
            </FieldLabel>

            <FieldLabel label="Nome do contato *">
              <input
                name="nome"
                required
                className="input"
                placeholder="Ex: Maria Costa"
              />
            </FieldLabel>
            <FieldLabel label="Empresa">
              <input
                name="empresa"
                className="input"
                placeholder="Empresa ou marca"
              />
            </FieldLabel>
            <FieldLabel label="WhatsApp">
              <input
                name="whatsapp"
                className="input"
                placeholder="(11) 90000-0000"
              />
            </FieldLabel>
            <FieldLabel label="E-mail">
              <input
                type="email"
                name="email"
                className="input"
                placeholder="email@exemplo.com"
              />
            </FieldLabel>
            <FieldLabel label="Valor (R$) *">
              <input
                name="valor_mensal"
                required
                className="input"
                placeholder="1500,00"
              />
            </FieldLabel>
            <FieldLabel label="Dia de cobrança (mensal) / Data vencimento (pontual)">
              <div className="flex gap-2">
                <input
                  type="number"
                  name="dia_cobranca"
                  min={1}
                  max={31}
                  defaultValue={10}
                  className="input w-24"
                  placeholder="Dia"
                  title="Pra mensal: dia 1-31"
                />
                <input
                  type="date"
                  name="data_vencimento"
                  className="input flex-1"
                  title="Pra pontual: data de vencimento"
                />
              </div>
            </FieldLabel>
            <FieldLabel label="Descrição / serviço" colSpan={2}>
              <input
                name="descricao"
                className="input"
                placeholder="Ex: SEO mensal / Taxa de setup / Licença anual"
              />
            </FieldLabel>
            <div className="sm:col-span-2 pt-2">
              <Button type="submit" size="sm">
                Adicionar
              </Button>
            </div>
          </form>
        </details>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          {(
            [
              { id: "todas", label: `Todas (${todas.length})` },
              { id: "ativas", label: `Ativas (${stats.ativas})` },
              { id: "atrasados", label: `Atrasadas (${stats.atrasados.length})` },
              { id: "a_cobrar", label: `A cobrar (${stats.aCobrar.length})` },
              { id: "pagos", label: `Pagas (${stats.pagos.length})` },
              { id: "inativas", label: `Inativas (${todas.length - stats.ativas})` },
            ] as const
          ).map((f) => (
            <a
              key={f.id}
              href={`/admin/cobrancas?status=${f.id}${urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""}`}
              className={
                "px-3 py-1.5 rounded-full border transition " +
                (filtro === f.id
                  ? "bg-fysi-deep text-fysi-cream border-fysi-deep"
                  : "bg-white border-fysi-line text-fysi-deep hover:border-fysi-deep/40")
              }
            >
              {f.label}
            </a>
          ))}
        </div>

        {/* Lista */}
        {lista.length === 0 ? (
          <div className="bg-white border border-fysi-line rounded-[16px] p-8 text-center text-fysi-muted text-sm">
            Nenhuma cobrança nesse filtro.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {lista.map((c) => (
              <CobrancaCard
                key={c.id}
                cobranca={c}
                refAtual={refAtual}
                urlKey={urlKey}
              />
            ))}
          </div>
        )}
      </ContentFrame>
    </Shell>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "slate" | "mint" | "amber";
}) {
  const t = {
    slate: "bg-white border-fysi-line",
    mint: "bg-fysi-mint border-fysi-mint-vivid/30",
    amber: "bg-fysi-yellow/20 border-fysi-yellow",
  }[tone];
  return (
    <div className={`rounded-[14px] border p-4 ${t}`}>
      <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
        {label}
      </div>
      <div className="text-2xl font-bold text-fysi-deep mt-1 tabular-nums">
        {value}
      </div>
      <div className="text-[0.7rem] text-fysi-muted mt-0.5">{sub}</div>
    </div>
  );
}

function FieldLabel({
  label,
  children,
  colSpan,
}: {
  label: string;
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <label
      className={`flex flex-col gap-1 ${colSpan === 2 ? "sm:col-span-2" : ""}`}
    >
      <span className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}

function CobrancaCard({
  cobranca,
  refAtual,
  urlKey,
}: {
  cobranca: CobrancaMensal;
  refAtual: string;
  urlKey: string | null;
}) {
  const status = statusDoMes(cobranca);
  const pagoEsteMes = cobranca.historico.find(
    (h) => h.mesReferencia === refAtual
  );
  const ultimo = cobranca.historico[cobranca.historico.length - 1];

  return (
    <div
      className={
        "bg-white border rounded-[16px] p-4 flex flex-col gap-3 " +
        (!cobranca.ativa
          ? "border-fysi-line opacity-60"
          : status === "atrasado"
            ? "border-amber-300 bg-amber-50/40"
            : "border-fysi-line")
      }
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Pill tone={cobranca.tipo === "pontual" ? "yellow" : "outline"}>
              {cobranca.tipo === "pontual" ? "📌 Pontual" : "🔁 Mensal"}
            </Pill>
            <h3 className="text-base font-semibold text-fysi-deep">
              {cobranca.nome}
            </h3>
            {!cobranca.ativa ? (
              <Pill tone="muted">Inativa</Pill>
            ) : status === "pago" ? (
              <Pill tone="mint">
                {cobranca.tipo === "pontual" ? "✓ pago" : "✓ pago este mês"}
              </Pill>
            ) : status === "atrasado" ? (
              <Pill tone="yellow">⚠ atrasado</Pill>
            ) : (
              <Pill tone="outline">
                {cobranca.tipo === "pontual"
                  ? `vence ${formatDate(cobranca.data_vencimento)}`
                  : `a cobrar dia ${cobranca.dia_cobranca}`}
              </Pill>
            )}
          </div>
          {cobranca.empresa ? (
            <p className="text-xs text-fysi-muted mt-0.5">{cobranca.empresa}</p>
          ) : null}
          {cobranca.descricao ? (
            <p className="text-sm text-fysi-deep/80 mt-1">
              {cobranca.descricao}
            </p>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-fysi-deep tabular-nums">
            {formatBRL(Number(cobranca.valor_mensal))}
          </div>
          <div className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted">
            {cobranca.tipo === "pontual"
              ? formatDate(cobranca.data_vencimento)
              : `todo dia ${cobranca.dia_cobranca}`}
          </div>
        </div>
      </div>

      {pagoEsteMes ? (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
          ✓ Recebido em{" "}
          {new Date(pagoEsteMes.pagoEm).toLocaleDateString("pt-BR")} ·{" "}
          {formatBRL(pagoEsteMes.valorPago)} · {pagoEsteMes.forma}
        </div>
      ) : ultimo ? (
        <p className="text-[0.7rem] text-fysi-muted">
          Último pagamento: {ultimo.mesReferencia} (
          {new Date(ultimo.pagoEm).toLocaleDateString("pt-BR")}) ·{" "}
          {formatBRL(ultimo.valorPago)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-fysi-line">
        {!pagoEsteMes && cobranca.ativa ? (
          <form action={marcarPagoEsteMesAction}>
            <input type="hidden" name="id" value={cobranca.id} />
            {urlKey ? (
              <input type="hidden" name="key" value={urlKey} />
            ) : null}
            <Button type="submit" size="sm">
              ✓ Marcar pago hoje
            </Button>
          </form>
        ) : null}

        <details className="text-xs">
          <summary className="cursor-pointer inline-flex items-center rounded-full border border-fysi-line bg-white px-3 py-1.5 text-fysi-deep hover:border-fysi-deep/40">
            💰 Registrar pagamento avulso
          </summary>
          <form
            action={registrarPagamentoAction}
            className="mt-2 grid sm:grid-cols-4 gap-2 p-3 bg-fysi-cream/30 rounded-md"
          >
            <input type="hidden" name="id" value={cobranca.id} />
            {urlKey ? (
              <input type="hidden" name="key" value={urlKey} />
            ) : null}
            <input
              name="mes_referencia"
              defaultValue={refAtual}
              placeholder="2026-06"
              className="input"
            />
            <input
              name="valor_pago"
              defaultValue={String(cobranca.valor_mensal).replace(".", ",")}
              placeholder="Valor"
              className="input"
            />
            <select name="forma" defaultValue="pix" className="input">
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
              <option value="boleto">Boleto</option>
              <option value="outro">Outro</option>
            </select>
            <Button type="submit" size="sm" variant="secondary">
              Registrar
            </Button>
          </form>
        </details>

        <details className="text-xs">
          <summary className="cursor-pointer inline-flex items-center rounded-full border border-fysi-line bg-white px-3 py-1.5 text-fysi-deep hover:border-fysi-deep/40">
            📋 Histórico ({cobranca.historico.length})
          </summary>
          <div className="mt-2 bg-fysi-cream/30 rounded-md p-3 flex flex-col gap-1">
            {cobranca.historico.length === 0 ? (
              <p className="text-fysi-muted text-xs">Sem pagamentos.</p>
            ) : (
              [...cobranca.historico].reverse().map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 text-xs bg-white border border-fysi-line rounded-md px-2 py-1"
                >
                  <span className="font-medium text-fysi-deep">
                    {h.mesReferencia}
                  </span>
                  <span className="text-fysi-deep tabular-nums">
                    {formatBRL(h.valorPago)}
                  </span>
                  <span className="text-fysi-muted">{h.forma}</span>
                  <span className="text-fysi-muted">
                    {new Date(h.pagoEm).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </details>

        <details className="text-xs ml-auto">
          <summary className="cursor-pointer inline-flex items-center rounded-full border border-fysi-line bg-white px-3 py-1.5 text-fysi-muted hover:text-fysi-deep">
            ⚙️ Editar / inativar
          </summary>
          <form
            action={updateCobrancaAction}
            className="mt-2 flex flex-col gap-2 p-3 bg-fysi-cream/30 rounded-md w-72"
          >
            <input type="hidden" name="id" value={cobranca.id} />
            {urlKey ? (
              <input type="hidden" name="key" value={urlKey} />
            ) : null}
            <input
              name="nome"
              defaultValue={cobranca.nome}
              placeholder="Nome"
              className="input"
            />
            <input
              name="empresa"
              defaultValue={cobranca.empresa ?? ""}
              placeholder="Empresa"
              className="input"
            />
            <input
              name="descricao"
              defaultValue={cobranca.descricao ?? ""}
              placeholder="Descrição"
              className="input"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="valor_mensal"
                defaultValue={String(cobranca.valor_mensal).replace(".", ",")}
                placeholder="Valor"
                className="input"
              />
              <input
                type="number"
                min={1}
                max={31}
                name="dia_cobranca"
                defaultValue={cobranca.dia_cobranca}
                placeholder="Dia"
                className="input"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="ativa"
                value="1"
                defaultChecked={cobranca.ativa}
              />
              <span>Ativa</span>
            </label>
            <Button type="submit" size="sm" variant="secondary">
              Salvar
            </Button>
          </form>
          <form
            action={deleteCobrancaAction}
            className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md w-72"
          >
            <input type="hidden" name="id" value={cobranca.id} />
            {urlKey ? (
              <input type="hidden" name="key" value={urlKey} />
            ) : null}
            <p className="text-[0.7rem] text-red-800 mb-2">
              Apagar permanente (incluindo histórico).
            </p>
            <button
              type="submit"
              className="text-xs text-red-700 hover:text-red-900 underline"
            >
              Apagar cobrança
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
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
