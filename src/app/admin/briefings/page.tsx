import { redirect } from "next/navigation";
import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listBriefingTemplates } from "@/lib/briefing-templates-server";
import { createBriefingTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

interface SearchParams {
  key?: string;
  q?: string;
}

interface ClientRow {
  id: string;
  nome: string | null;
  empresa: string | null;
  email: string | null;
  briefing_submitted_at: string | null;
  current_stage_index: number | null;
}

export default async function BriefingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Escopo por papel: "básico" só enxerga os clientes em que está marcado
  // (mesma regra das outras listas). Antes esta tela listava TODOS.
  const visibleIds = await getVisibleClientIds(member);

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const templates = await listBriefingTemplates();

  const q = (params.q ?? "").trim();
  const supabase = createSupabaseServiceRoleClient();
  let clientsQuery = supabase
    .from("clients")
    .select(
      "id, nome, empresa, email, briefing_submitted_at, current_stage_index",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  if (visibleIds) clientsQuery = clientsQuery.in("id", Array.from(visibleIds));
  if (q) {
    clientsQuery = clientsQuery.or(
      `nome.ilike.%${q}%,empresa.ilike.%${q}%,email.ilike.%${q}%`,
    );
  }
  // Sem nenhum cliente visível, nem chega a consultar: `.in(col, [])` do
  // PostgREST não é confiável pra "nada" (pode devolver tudo).
  const clientsData =
    visibleIds && visibleIds.size === 0 ? [] : (await clientsQuery).data;
  const clients = (clientsData ?? []) as ClientRow[];

  return (
    <AdminShell
      active="briefings"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div>
                <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
                  Briefings
                </h1>
                <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
                  Monte um briefing de perguntas uma vez e aplique a quantos
                  clientes quiser.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="muted">
                  {templates.length} briefing
                  {templates.length === 1 ? "" : "s"}
                </Pill>
              </div>
            </header>

            {/* Sub-abas: Respostas (esta página) / Documentos (hub de blocos) */}
            <div className="flex gap-1.5 mb-6 w-fit rounded-full border border-fysi-line bg-white p-1">
              <Pill tone="deep" className="rounded-full px-3.5 py-1.5">
                Respostas
              </Pill>
              <Link
                href={`/admin/briefing-documentos${keyParam}`}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium text-fysi-muted hover:bg-fysi-cream transition"
              >
                Documentos
              </Link>
            </div>

            {/* Criar novo */}
            <form
              action={createBriefingTemplateAction}
              className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end"
            >
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <label className="text-sm font-medium text-fysi-deep">
                  Novo briefing
                </label>
                <input
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
                Criar briefing
              </SubmitTextButton>
            </form>

            {/* Lista */}
            {templates.length === 0 ? (
              <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center text-fysi-muted text-sm">
                Nenhum briefing criado ainda. Crie o primeiro acima — depois é
                só montar as perguntas e aplicar a um cliente.
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

            {/* Briefings dos clientes */}
            <section className="mt-10">
              <header className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-fysi-deep">
                  Briefings dos clientes
                </h2>
                <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
                  Encontre o briefing de um cliente específico e abra direto na
                  ficha dele.
                </p>
              </header>

              <form
                method="get"
                className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-end"
              >
                {urlKey ? (
                  <input type="hidden" name="key" value={urlKey} />
                ) : null}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <label className="text-sm font-medium text-fysi-deep">
                    Buscar cliente
                  </label>
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Buscar cliente por nome, empresa ou e-mail…"
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
                    ? `Nenhum cliente encontrado para "${q}". Tente outro nome, empresa ou e-mail.`
                    : "Nenhum cliente cadastrado ainda."}
                  {!q ? (
                    <>
                      {" "}
                      <Link href={`/admin/novo${keyParam}`} className="text-fysi-deep underline">
                        Cadastrar o primeiro
                      </Link>
                      .
                    </>
                  ) : null}
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {clients.map((c) => {
                    const enviado = Boolean(c.briefing_submitted_at);
                    const emAndamento = (c.current_stage_index ?? 0) > 0;
                    const selo = enviado
                      ? { label: "✓ enviado", cls: "bg-fysi-mint text-fysi-deep" }
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
                        className="bg-white border border-fysi-line rounded-[16px] shadow-fysi-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
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
                          href={`/admin/${c.id}${keyParam}#briefing`}
                          className="text-sm font-medium text-fysi-deep whitespace-nowrap hover:text-fysi-deep/70"
                        >
                          Abrir briefing →
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
    </AdminShell>
  );
}
