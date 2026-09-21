import { redirect } from "next/navigation";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listBriefingTemplates } from "@/lib/briefing-templates-server";
import { listarBriefings } from "@/lib/briefings-server";
import { createBriefingTemplateAction, importarBriefingsAction } from "./actions";

export const dynamic = "force-dynamic";

type Aba = "documentos" | "respostas" | "modelos";
const ABAS: { id: Aba; label: string }[] = [
  { id: "documentos", label: "Documentos" },
  { id: "respostas", label: "Preenchidos pelo cliente" },
  { id: "modelos", label: "Modelos de perguntas" },
];

interface SearchParams {
  key?: string;
  q?: string;
  aba?: string;
  filtro?: string;
  imp?: string;
  res?: string;
  motivo?: string;
}

interface ClientRow {
  id: string;
  nome: string | null;
  empresa: string | null;
  email: string | null;
  briefing_submitted_at: string | null;
  current_stage_index: number | null;
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Hub central de Briefings.
 *
 * Antes desta tela "briefing" significava três coisas em três lugares:
 * esta página listava CLIENTES, /admin/briefings/[id] editava um MODELO de
 * perguntas e /admin/briefing-documentos abria o DOCUMENTO. Pedido do
 * usuário em 2026-09-20 ("os briefings devem poder ser acessados de forma
 * separada da pessoa"), as três viraram abas de um lugar só, com o
 * documento — que é o briefing de verdade — como aba de entrada.
 */
export default async function BriefingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const visibleIds = await getVisibleClientIds(member);
  const acessoTotal = hasFullAccess(member);
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const aba: Aba = ABAS.some((a) => a.id === params.aba)
    ? (params.aba as Aba)
    : "documentos";
  const q = (params.q ?? "").trim();
  const filtro = params.filtro ?? "todos";

  const linkAba = (id: Aba) => {
    const sp = new URLSearchParams();
    if (urlKey) sp.set("key", urlKey);
    if (id !== "documentos") sp.set("aba", id);
    const s = sp.toString();
    return `/admin/briefings${s ? `?${s}` : ""}`;
  };

  // ---------- Aba Documentos ----------
  let docs = aba === "documentos" ? await listarBriefings() : [];
  if (aba === "documentos") {
    // Escopo por papel: "básico" (designer) só vê briefing de cliente em que
    // está marcado. Briefing avulso (sem cliente) não tem como ser escopado,
    // então fica fora — é justamente o vazamento que o usuário apontou.
    if (visibleIds) {
      docs = docs.filter(
        (d) => d.clientId !== null && visibleIds.has(d.clientId)
      );
    }
    if (q) {
      const alvo = q.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.titulo.toLowerCase().includes(alvo) ||
          (d.clienteNome ?? "").toLowerCase().includes(alvo)
      );
    }
    if (filtro === "compartilhados") docs = docs.filter((d) => d.compartilhado);
    else if (filtro === "avulsos") docs = docs.filter((d) => !d.clientId && !d.isTemplate);
    else if (filtro === "vazios")
      docs = docs.filter((d) => !d.isTemplate && d.preenchimento < 5);
  }

  const totalCompartilhados = docs.filter((d) => d.compartilhado).length;
  const totalAvulsos = docs.filter((d) => !d.clientId && !d.isTemplate).length;

  // ---------- Aba Modelos ----------
  const templates = aba === "modelos" ? await listBriefingTemplates() : [];

  // ---------- Aba Respostas ----------
  let clients: ClientRow[] = [];
  if (aba === "respostas") {
    const supabase = createSupabaseServiceRoleClient();
    let cq = supabase
      .from("clients")
      .select("id, nome, empresa, email, briefing_submitted_at, current_stage_index")
      .order("created_at", { ascending: false })
      .limit(60);
    if (visibleIds) cq = cq.in("id", Array.from(visibleIds));
    if (q) {
      cq = cq.or(`nome.ilike.%${q}%,empresa.ilike.%${q}%,email.ilike.%${q}%`);
    }
    // `.in(col, [])` do PostgREST não é confiável pra "nada" — pode devolver tudo.
    const data = visibleIds && visibleIds.size === 0 ? [] : (await cq).data;
    clients = (data ?? []) as ClientRow[];
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
      <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
            Briefings
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            O briefing vive aqui, não dentro da ficha do cliente. Cada um pode
            ser aberto e compartilhado por um link próprio.
          </p>
        </div>
        {aba === "documentos" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="muted">
              {docs.length} briefing{docs.length === 1 ? "" : "s"}
            </Pill>
            {totalCompartilhados > 0 ? (
              <Pill tone="mint">{totalCompartilhados} com link</Pill>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Abas */}
      <div className="flex flex-wrap gap-1.5 mb-6 w-fit rounded-full border border-fysi-line bg-white p-1">
        {ABAS.map((a) =>
          a.id === aba ? (
            <span
              key={a.id}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium bg-fysi-deep text-fysi-cream"
            >
              {a.label}
            </span>
          ) : (
            <Link
              key={a.id}
              href={linkAba(a.id)}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-fysi-muted hover:bg-fysi-cream transition"
            >
              {a.label}
            </Link>
          )
        )}
      </div>

      {/* ================= DOCUMENTOS ================= */}
      {aba === "documentos" ? (
        <>
          <form
            method="get"
            className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-sm font-medium text-fysi-deep" htmlFor="q">
                Buscar briefing
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nome do briefing ou do cliente…"
                className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-fysi-deep" htmlFor="filtro">
                Mostrar
              </label>
              <select
                id="filtro"
                name="filtro"
                defaultValue={filtro}
                className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
              >
                <option value="todos">Todos</option>
                <option value="compartilhados">Só com link público</option>
                <option value="avulsos">Só sem cliente vinculado</option>
                <option value="vazios">Só em branco</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 whitespace-nowrap"
            >
              Filtrar
            </button>
          </form>

          {params.imp === "ok" ? (
            (() => {
              const n = (params.res ?? "").split("-").map((x) => Number(x) || 0);
              return (
                <p className="text-sm text-fysi-deep bg-fysi-mint/40 border border-fysi-mint-vivid/40 rounded-[12px] px-4 py-3 mb-4">
                  Importação concluída: {n[0]} briefing{n[0] === 1 ? "" : "s"} novo
                  {n[0] === 1 ? "" : "s"}, {n[1]} atualizado
                  {n[1] === 1 ? "" : "s"}.
                  {n[2] > 0
                    ? ` ${n[2]} não deram pra vincular a um cliente com segurança e ficaram avulsos — abra e escolha o cliente.`
                    : ""}
                  {n[3] > 0
                    ? ` ${n[3]} credencia${n[3] === 1 ? "l foi retirada" : "is foram retiradas"} do corpo e guardada${n[3] === 1 ? "" : "s"} em Acessos.`
                    : ""}
                </p>
              );
            })()
          ) : null}
          {params.imp === "erro" ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
              {params.motivo ?? "Não consegui importar agora."}
            </p>
          ) : null}

          {acessoTotal ? (
            <form
              action={importarBriefingsAction}
              className="bg-fysi-mint/30 border border-fysi-mint-vivid/40 rounded-[16px] p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fysi-deep">
                  Puxar os briefings do ClickUp
                </p>
                <p className="text-xs text-fysi-muted mt-0.5">
                  Traz o conteúdo real de cada página — caixinhas marcadas,
                  links e referências. Rodar de novo atualiza o que mudou lá,
                  sem duplicar. Senhas de domínio e hospedagem são separadas
                  do corpo e ficam fora do link público.
                </p>
              </div>
              <SubmitTextButton
                className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 whitespace-nowrap disabled:opacity-50"
                pendingLabel="Importando…"
              >
                Sincronizar do ClickUp
              </SubmitTextButton>
            </form>
          ) : null}

          {docs.length === 0 ? (
            <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center">
              <p className="text-fysi-deep font-medium mb-1">
                {q || filtro !== "todos"
                  ? "Nenhum briefing com esse filtro"
                  : "Nenhum briefing ainda"}
              </p>
              <p className="text-sm text-fysi-muted max-w-md mx-auto">
                {q || filtro !== "todos"
                  ? "Tente outro termo ou volte pra “Todos”."
                  : acessoTotal
                    ? "Use “Sincronizar do ClickUp” acima pra trazer os briefings que já existem lá."
                    : "Os briefings aparecem aqui assim que a equipe importar."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/briefings/doc/${d.id}${keyParam}`}
                    className="group block bg-white border border-fysi-line rounded-[14px] shadow-fysi-card px-4 py-3 hover:border-fysi-mint-vivid transition"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <p className="font-semibold text-fysi-deep truncate min-w-0 flex-1">
                        {d.titulo}
                      </p>
                      {d.isTemplate ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-fysi-cream text-fysi-muted border border-fysi-line">
                          modelo
                        </span>
                      ) : null}
                      {d.compartilhado ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-fysi-mint text-fysi-deep">
                          <span className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
                          link ativo
                        </span>
                      ) : null}
                      {d.temCredenciais ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          tem acessos
                        </span>
                      ) : null}
                      {!d.isTemplate && d.preenchimento < 5 ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white border border-fysi-line text-fysi-muted">
                          em branco
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-fysi-muted">
                      {d.clienteNome ? (
                        <span className="truncate">{d.clienteNome}</span>
                      ) : d.isTemplate ? null : (
                        <span className="text-amber-700">sem cliente vinculado</span>
                      )}
                      {d.origem === "clickup" ? <span>via ClickUp</span> : null}
                      {!d.isTemplate ? (
                        <span>
                          {d.preenchimento} linha{d.preenchimento === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      <span>{dataCurta(d.updatedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {totalAvulsos > 0 && filtro === "todos" ? (
            <p className="text-xs text-fysi-muted mt-4">
              {totalAvulsos} briefing{totalAvulsos === 1 ? "" : "s"} ainda sem
              cliente vinculado — abra e escolha o cliente, ou deixe avulso se
              for de alguém que não virou projeto.
            </p>
          ) : null}
        </>
      ) : null}

      {/* ================= MODELOS ================= */}
      {aba === "modelos" ? (
        <>
          {acessoTotal ? (
            <form
              action={createBriefingTemplateAction}
              className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end"
            >
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <label className="text-sm font-medium text-fysi-deep" htmlFor="nome">
                  Novo modelo de perguntas
                </label>
                <input
                  id="nome"
                  name="nome"
                  required
                  placeholder="Ex: Briefing — Landing Page"
                  className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
                />
              </div>
              <SubmitTextButton
                className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 whitespace-nowrap disabled:opacity-50"
                pendingLabel="Criando…"
              >
                Criar modelo
              </SubmitTextButton>
            </form>
          ) : null}

          {templates.length === 0 ? (
            <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center text-fysi-muted text-sm">
              Nenhum modelo criado ainda.
            </div>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {templates.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/briefings/${t.id}${keyParam}`}
                    className="block bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 hover:border-fysi-mint-vivid transition h-full"
                  >
                    <p className="font-semibold text-fysi-deep">{t.nome}</p>
                    <p className="text-xs text-fysi-muted mt-1">
                      {t.perguntas.length} pergunta
                      {t.perguntas.length === 1 ? "" : "s"}
                    </p>
                    <span className="text-xs font-medium text-fysi-deep mt-3 inline-block">
                      Editar e aplicar →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {/* ================= RESPOSTAS ================= */}
      {aba === "respostas" ? (
        <>
          <form
            method="get"
            className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
            <input type="hidden" name="aba" value="respostas" />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-sm font-medium text-fysi-deep" htmlFor="qc">
                Buscar cliente
              </label>
              <input
                id="qc"
                name="q"
                defaultValue={q}
                placeholder="Nome, empresa ou e-mail…"
                className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 whitespace-nowrap"
            >
              Filtrar
            </button>
          </form>

          {clients.length === 0 ? (
            <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center text-fysi-muted text-sm">
              {q
                ? `Nenhum cliente encontrado para "${q}".`
                : "Nenhum cliente cadastrado ainda."}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {clients.map((c) => {
                const enviado = Boolean(c.briefing_submitted_at);
                const emAndamento = (c.current_stage_index ?? 0) > 0;
                const selo = enviado
                  ? { label: "enviado", cls: "bg-fysi-mint text-fysi-deep" }
                  : emAndamento
                    ? {
                        label: "em andamento",
                        cls: "bg-white border border-fysi-line text-fysi-deep",
                      }
                    : {
                        label: "aguardando",
                        cls: "bg-white border border-fysi-line text-fysi-muted",
                      };
                return (
                  <li
                    key={c.id}
                    className="bg-white border border-fysi-line rounded-[14px] shadow-fysi-card px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-fysi-deep truncate">
                          {c.empresa || c.nome || "Cliente sem nome"}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${selo.cls}`}
                        >
                          {selo.label}
                        </span>
                      </div>
                      {c.email ? (
                        <p className="text-xs text-fysi-muted mt-1 truncate">
                          {c.email}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/admin/${c.id}?tab=briefing${
                        urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""
                      }`}
                      className="text-sm font-medium text-fysi-deep whitespace-nowrap hover:text-fysi-deep/70"
                    >
                      Ver respostas →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </AdminShell>
  );
}
