import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import { CopyButton } from "@/components/admin/copy-button";
import { EIView } from "@/components/admin/ei-view";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { obterBriefing } from "@/lib/briefings-server";
import {
  compartilharBriefingAction,
  revogarCompartilhamentoAction,
  vincularBriefingAction,
} from "../../actions";

export const dynamic = "force-dynamic";

/**
 * O briefing aberto como documento próprio — fora da ficha do cliente.
 *
 * É aqui que fica o link público: token separado do `magic_slug`, que abre
 * painel + moodboard + entrega de uma vez. Compartilhar o briefing não pode
 * dar acesso a mais nada.
 */
export default async function BriefingDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  const urlKey = key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const doc = await obterBriefing(id);
  if (!doc) notFound();

  // Escopo por papel: "básico" só abre briefing de cliente em que está
  // marcado — e nunca briefing avulso, que não dá pra escopar.
  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && (!doc.clientId || !visibleIds.has(doc.clientId))) {
    redirect(`/admin/briefings${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  const acessoTotal = hasFullAccess(member);
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const linkPublico =
    doc.compartilhado && doc.shareToken ? `${baseUrl}/b/${doc.shareToken}` : null;

  // Lista de clientes só é necessária pra vincular um briefing avulso.
  let clientes: { id: string; nome: string | null; empresa: string | null }[] = [];
  if (acessoTotal && !doc.isTemplate) {
    const service = createSupabaseServiceRoleClient();
    const { data } = await service
      .from("clients")
      .select("id, nome, empresa")
      .order("empresa", { ascending: true });
    clientes = (data as typeof clientes | null) ?? [];
  }

  return (
    <AdminShell
      active="briefings"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <Link
        href={`/admin/briefings${keyParam}`}
        className="text-sm text-fysi-muted hover:text-fysi-deep inline-block mb-3"
      >
        ← Todos os briefings
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
            {doc.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {doc.clienteNome ? (
              <Link
                href={`/admin/${doc.clientId}${keyParam}`}
                className="text-sm text-fysi-deep underline hover:text-fysi-deep/70"
              >
                {doc.clienteNome}
              </Link>
            ) : doc.isTemplate ? null : (
              <Pill tone="muted">sem cliente vinculado</Pill>
            )}
            {doc.origem === "clickup" ? (
              <span className="text-xs text-fysi-muted">via ClickUp</span>
            ) : null}
            {doc.compartilhado ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-fysi-mint text-fysi-deep">
                <span className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
                link público ativo
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* ---- Link público ---- */}
      {acessoTotal ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-5">
          <Eyebrow>Compartilhar só este briefing</Eyebrow>
          <p className="text-xs text-fysi-muted mt-1 mb-3 max-w-2xl">
            Link próprio, que abre este briefing e mais nada — não dá acesso à
            ficha do cliente, ao painel nem a valores. Senhas de domínio e
            hospedagem ficam sempre de fora.
          </p>

          {linkPublico ? (
            <>
              <div className="flex items-center gap-2 bg-fysi-mint/40 border border-fysi-mint-vivid/40 rounded-[12px] p-3">
                <a
                  href={linkPublico}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fysi-deep underline break-all text-sm flex-1"
                >
                  {linkPublico}
                </a>
                <CopyButton value={linkPublico} label="Copiar link" />
              </div>
              {doc.shareExpiresAt ? (
                <p className="text-xs text-fysi-muted mt-2">
                  Expira em{" "}
                  {new Date(doc.shareExpiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
                </p>
              ) : null}
              <form action={revogarCompartilhamentoAction} className="mt-3">
                {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                <input type="hidden" name="id" value={doc.id} />
                <SubmitTextButton
                  className="rounded-full border border-red-200 text-red-700 text-sm font-medium px-4 py-2 hover:bg-red-50 disabled:opacity-50"
                  pendingLabel="Revogando…"
                >
                  Revogar link
                </SubmitTextButton>
              </form>
              <p className="text-xs text-fysi-muted mt-2">
                Revogar troca o endereço: quem tiver o link antigo perde o
                acesso pra sempre, mesmo se você gerar outro depois.
              </p>
            </>
          ) : (
            <form
              action={compartilharBriefingAction}
              className="flex flex-col sm:flex-row gap-3 sm:items-end"
            >
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <input type="hidden" name="id" value={doc.id} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-fysi-deep" htmlFor="dias">
                  Validade
                </label>
                <select
                  id="dias"
                  name="dias"
                  defaultValue=""
                  className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
                >
                  <option value="">Sem prazo</option>
                  <option value="7">7 dias</option>
                  <option value="30">30 dias</option>
                  <option value="90">90 dias</option>
                </select>
              </div>
              <SubmitTextButton
                className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 disabled:opacity-50"
                pendingLabel="Gerando…"
              >
                Gerar link público
              </SubmitTextButton>
            </form>
          )}
        </section>
      ) : null}

      {/* ---- Vincular a um cliente ---- */}
      {acessoTotal && !doc.isTemplate ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-5">
          <Eyebrow>Cliente vinculado</Eyebrow>
          <p className="text-xs text-fysi-muted mt-1 mb-3">
            Um cliente pode ter mais de um briefing (projetos diferentes, meses
            diferentes). Deixe em branco se for de alguém que não virou projeto.
          </p>
          <form
            action={vincularBriefingAction}
            className="flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <input type="hidden" name="id" value={doc.id} />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-sm font-medium text-fysi-deep" htmlFor="clientId">
                Cliente
              </label>
              <select
                id="clientId"
                name="clientId"
                defaultValue={doc.clientId ?? ""}
                className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
              >
                <option value="">Sem cliente (avulso)</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.empresa?.trim() || c.nome?.trim() || "Sem nome"}
                  </option>
                ))}
              </select>
            </div>
            <SubmitTextButton
              className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 disabled:opacity-50"
              pendingLabel="Salvando…"
            >
              Salvar vínculo
            </SubmitTextButton>
          </form>
        </section>
      ) : null}

      {/* ---- Acessos (credenciais) ---- */}
      {doc.credenciais.length > 0 ? (
        acessoTotal ? (
          <section className="bg-amber-50/60 border border-amber-200 rounded-[20px] p-5 mb-5">
            <Eyebrow>Acessos</Eyebrow>
            <p className="text-xs text-fysi-muted mt-1 mb-3">
              Separados do corpo do briefing na importação. Nunca aparecem no
              link público.
            </p>
            <ul className="flex flex-col gap-2">
              {doc.credenciais.map((c, i) => (
                <li
                  key={`${c.contexto}-${c.rotulo}-${i}`}
                  className="bg-white border border-amber-200 rounded-[12px] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="text-xs uppercase tracking-[0.1em] text-fysi-muted">
                    {c.contexto}
                  </span>
                  <span className="text-sm font-medium text-fysi-deep">
                    {c.rotulo}
                  </span>
                  <code className="text-sm font-mono text-fysi-deep break-all flex-1 min-w-0">
                    {c.valor}
                  </code>
                  <CopyButton value={c.valor} label="Copiar" />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-xs text-fysi-muted bg-fysi-cream/60 border border-fysi-line rounded-[12px] px-4 py-3 mb-5">
            Este briefing tem acessos guardados (domínio/hospedagem). Só quem
            tem visão completa consegue vê-los.
          </p>
        )
      ) : null}

      {/* ---- O briefing ---- */}
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6">
        <EIView
          docId={doc.id}
          urlKey={urlKey}
          initialBlocks={doc.blocks}
          atualizadoAt={doc.updatedAt}
        />
      </section>
    </AdminShell>
  );
}
