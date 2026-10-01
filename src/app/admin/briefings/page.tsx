import { redirect } from "next/navigation";
import Link from "next/link";
import { SubmitTextButton } from "@/components/admin/submit-button";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { EIDocumentSidebar } from "@/components/admin/ei-document-sidebar";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listBriefingTemplates } from "@/lib/briefing-templates-server";
import {
  briefingsParaBarraLateral,
  briefingsVisiveis,
  listarBriefings,
  type BriefingResumo,
} from "@/lib/briefings-server";
import {
  listClientesParaNovoDocumento,
  listarModelos,
} from "@/lib/ei-documents-server";
import { resumosPorCliente } from "@/lib/materiais-cliente-server";
import { fraseResumo, type ResumoMateriais } from "@/lib/materiais-cliente";
import {
  createBriefingTemplateAction,
  criarBriefingAction,
  deleteBriefingTemplateAction,
  importarBriefingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Aba = "documentos" | "respostas" | "modelos";
/** Rótulos curtos: as sub-abas moram na barra lateral, com 264px de largura. */
const ABAS: { id: Aba; label: string }[] = [
  { id: "documentos", label: "Briefings" },
  { id: "respostas", label: "Preenchidos" },
  { id: "modelos", label: "Modelos" },
];

type Filtro = "todos" | "compartilhados" | "avulsos" | "vazios";
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "compartilhados", label: "Com link público" },
  { id: "avulsos", label: "Sem cliente" },
  { id: "vazios", label: "Não começados" },
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
    // Sem fuso, o servidor (UTC na Vercel) mostra o dia seguinte pra tudo
    // que foi salvo depois das 21h em Brasília.
    timeZone: "America/Sao_Paulo",
  });
}

/** Coluna "Estado": em que pé está o preenchimento. */
function estadoDe(d: BriefingResumo): string {
  if (d.isTemplate) return "modelo";
  if (d.igualAoModelo) return "nada preenchido";
  if (d.preenchimento < 5) return "em branco";
  return `${d.preenchimento} linhas`;
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
 *
 * O FORMATO virou o do ClickUp Docs em 2026-09-28, com print ao lado:
 * "essa tela de briefing é ruim, quero a com todos como no click up, layout
 * clean, limpo, pastinhas na lateral lista com clientes, posso pesquisar ali
 * também, criar um novo fácil". Era uma pilha de cartões — busca dentro de um
 * cartão, painel verde de sincronizar, 37 briefings um embaixo do outro.
 * Agora é a mesma composição dos outros três hubs de documento (EI,
 * Documentos de Briefing, Em branco): EIDocumentSidebar à esquerda, com a
 * lista, a busca instantânea e o botão de criar; conteúdo à direita.
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
  const filtro: Filtro = FILTROS.some((f) => f.id === params.filtro)
    ? (params.filtro as Filtro)
    : "todos";

  const linkAba = (id: Aba) => {
    const sp = new URLSearchParams();
    if (urlKey) sp.set("key", urlKey);
    if (id !== "documentos") sp.set("aba", id);
    const s = sp.toString();
    return `/admin/briefings${s ? `?${s}` : ""}`;
  };
  const linkFiltro = (id: Filtro, busca: string = q) => {
    const sp = new URLSearchParams();
    if (urlKey) sp.set("key", urlKey);
    if (busca) sp.set("q", busca);
    if (id !== "todos") sp.set("filtro", id);
    const s = sp.toString();
    return `/admin/briefings${s ? `?${s}` : ""}`;
  };

  /**
   * A barra lateral é a MESMA nas três sub-abas — é a navegação do hub, não
   * um enfeite da aba de entrada. Por isso a lista e os clientes carregam
   * sempre, e não só quando aba === "documentos".
   */
  const [todos, clientesTodos] = await Promise.all([
    listarBriefings(),
    listClientesParaNovoDocumento("briefing"),
  ]);

  const escopados = briefingsVisiveis(todos, visibleIds);
  const sidebarDocs = briefingsParaBarraLateral(escopados);
  const clientesParaCriar = visibleIds
    ? clientesTodos.filter((c) => visibleIds.has(c.id))
    : clientesTodos;

  // ---------- Aba Briefings (lista de todos) ----------
  const base = q
    ? escopados.filter(
        (d) =>
          d.titulo.toLowerCase().includes(q.toLowerCase()) ||
          (d.clienteNome ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : escopados;

  // Contagem de cada filtro ANTES de filtrar — o número no chip precisa
  // dizer quantos existem, não quantos sobraram do próprio chip.
  const contagem: Record<Filtro, number> = {
    todos: base.length,
    compartilhados: base.filter((d) => d.compartilhado).length,
    avulsos: base.filter((d) => !d.clientId && !d.isTemplate).length,
    vazios: base.filter(
      (d) => !d.isTemplate && (d.igualAoModelo || d.preenchimento < 5)
    ).length,
  };

  const docs =
    filtro === "compartilhados"
      ? base.filter((d) => d.compartilhado)
      : filtro === "avulsos"
        ? base.filter((d) => !d.clientId && !d.isTemplate)
        : filtro === "vazios"
          ? base.filter(
              (d) => !d.isTemplate && (d.igualAoModelo || d.preenchimento < 5)
            )
          : base;

  // "faltam 3 de 8" ao lado de cada cliente, na linha do briefing dele. Uma
  // consulta só pra lista inteira — uma por linha derrubaria a tela.
  const resumoMateriais: Map<string, ResumoMateriais> =
    aba === "documentos"
      ? await resumosPorCliente(
          docs.map((d) => d.clientId).filter((id): id is string => Boolean(id))
        )
      : new Map();

  // ---------- Aba Modelos ----------
  const templates = aba === "modelos" ? await listBriefingTemplates() : [];

  // ---------- Aba Preenchidos ----------
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

  const tituloAba =
    aba === "documentos"
      ? "Briefings"
      : aba === "respostas"
        ? "Preenchidos pelo cliente"
        : "Modelos de perguntas";

  const modelosDeBriefing = await listarModelos("briefing");

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
      <div className="flex -mx-4 md:-mx-6 lg:-mx-8 -my-6 h-[calc(100vh-3.5rem)]">
        <EIDocumentSidebar
          docs={sidebarDocs}
          // Nenhum documento aberto: esta é a tela de índice do hub.
          activeId=""
          urlKey={urlKey}
          clientsWithoutDoc={clientesParaCriar}
          modelos={modelosDeBriefing}
          basePath="/admin/briefings/doc"
          createAction={criarBriefingAction}
          createLabel="+ Novo briefing"
          subTabs={ABAS.map((a) => ({
            label: a.label,
            href: linkAba(a.id),
            active: a.id === aba,
          }))}
        />

        <div className="flex-1 min-w-0 overflow-y-auto bg-white">
          {/* Linha de controle: o que era cartão de busca, painel verde de
              sincronizar e formulário de criar modelo cabe todo aqui. */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-fysi-line bg-white/95 px-5 py-3 backdrop-blur">
            <h1 className="text-base font-semibold tracking-tight text-fysi-deep">
              {tituloAba}
            </h1>

            {aba === "documentos" ? (
              <div className="flex flex-wrap items-center gap-1">
                {/* Filtro que não pega nada só ocupa espaço. Ficam de pé o
                    "Todos" (é a saída de qualquer filtro) e o ativo, que
                    precisa continuar visível mesmo quando zera. */}
                {FILTROS.filter(
                  (f) => f.id === "todos" || f.id === filtro || contagem[f.id] > 0
                ).map((f) =>
                  f.id === filtro ? (
                    <span
                      key={f.id}
                      className="rounded-full bg-fysi-deep px-2.5 py-1 text-xs font-medium text-fysi-cream"
                    >
                      {f.label}
                      <span className="ml-1.5 tabular-nums opacity-70">
                        {contagem[f.id]}
                      </span>
                    </span>
                  ) : (
                    <Link
                      key={f.id}
                      href={linkFiltro(f.id)}
                      className="rounded-full px-2.5 py-1 text-xs font-medium text-fysi-muted transition hover:bg-fysi-cream hover:text-fysi-deep"
                    >
                      {f.label}
                      <span className="ml-1.5 tabular-nums opacity-70">
                        {contagem[f.id]}
                      </span>
                    </Link>
                  )
                )}
                {/* A busca do dia a dia é a da barra lateral, instantânea. Este
                    chip existe porque `?q=` continua valendo por link (e a
                    lista à direita fica filtrada por ele) — sem ele, não havia
                    como perceber nem desfazer o filtro. */}
                {q ? (
                  <Link
                    href={linkFiltro(filtro, "")}
                    className="rounded-full border border-fysi-line px-2.5 py-1 text-xs font-medium text-fysi-deep hover:bg-fysi-cream"
                  >
                    busca “{q}” · limpar
                  </Link>
                ) : null}
              </div>
            ) : null}

            {/* Lado direito da linha: a ação da aba. `ml-auto` em vez de um
                espaçador flex-1 — com flex-wrap, o espaçador vazio virava uma
                linha só dele e empurrava o botão pra baixo. */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {aba === "documentos" && acessoTotal ? (
                <form action={importarBriefingsAction}>
                  {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                  <SubmitTextButton
                    className="whitespace-nowrap rounded-full border border-fysi-line-strong px-3.5 py-1.5 text-xs font-medium text-fysi-deep hover:bg-fysi-cream disabled:opacity-50"
                    pendingLabel="Importando…"
                  >
                    Sincronizar do ClickUp
                  </SubmitTextButton>
                </form>
              ) : null}

              {aba === "respostas" ? (
                <form method="get" className="flex items-center gap-2">
                  {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                  <input type="hidden" name="aba" value="respostas" />
                  {/* A busca da barra lateral procura BRIEFING; esta procura
                      CLIENTE no banco. São entidades diferentes, por isso as
                      duas existem — e só uma aparece por aba. */}
                  <input
                    name="q"
                    defaultValue={q}
                    aria-label="Buscar cliente"
                    placeholder="Nome, empresa ou e-mail…"
                    className="w-56 rounded-[8px] border border-fysi-line bg-fysi-cream/40 px-3 py-1.5 text-sm text-fysi-deep"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-full border border-fysi-line-strong px-3.5 py-1.5 text-xs font-medium text-fysi-deep hover:bg-fysi-cream"
                  >
                    Buscar
                  </button>
                </form>
              ) : null}

              {aba === "modelos" && acessoTotal ? (
                <form
                  action={createBriefingTemplateAction}
                  className="flex items-center gap-2"
                >
                  {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                  <input
                    name="nome"
                    required
                    aria-label="Nome do novo modelo de perguntas"
                    placeholder="Ex: Briefing — Landing Page"
                    className="w-60 rounded-[8px] border border-fysi-line bg-fysi-cream/40 px-3 py-1.5 text-sm text-fysi-deep"
                  />
                  <SubmitTextButton
                    className="whitespace-nowrap rounded-full bg-fysi-deep px-3.5 py-1.5 text-xs font-medium text-fysi-cream hover:bg-fysi-deep/90 disabled:opacity-50"
                    pendingLabel="Criando…"
                  >
                    + Criar modelo
                  </SubmitTextButton>
                </form>
              ) : null}
            </div>
          </div>

          {/* ================= BRIEFINGS (todos) ================= */}
          {aba === "documentos" ? (
            <>
              {params.imp === "ok" ? (
                (() => {
                  const n = (params.res ?? "").split("-").map((x) => Number(x) || 0);
                  return (
                    <p className="mx-5 mt-4 rounded-[12px] border border-fysi-mint-vivid/40 bg-fysi-mint/40 px-4 py-3 text-sm text-fysi-deep">
                      Importação concluída: {n[0]} briefing{n[0] === 1 ? "" : "s"} novo
                      {n[0] === 1 ? "" : "s"}, {n[1]} atualizado
                      {n[1] === 1 ? "" : "s"}.
                      {n[2] > 0
                        ? ` ${n[2]} não deram pra vincular a um cliente com segurança e ficaram avulsos — abra e escolha o cliente.`
                        : ""}
                      {n[3] > 0
                        ? ` ${n[3]} credencia${n[3] === 1 ? "l foi retirada" : "is foram retiradas"} do corpo e guardada${n[3] === 1 ? "" : "s"} em Acessos.`
                        : ""}
                      {/* Sem esta linha, o briefing preservado sumiria da conta
                          e pareceria que a importação o ignorou por erro. */}
                      {n[4] > 0
                        ? ` ${n[4]} não ${n[4] === 1 ? "foi tocado" : "foram tocados"} porque ${n[4] === 1 ? "tinha" : "tinham"} edição mais nova aqui no app.`
                        : ""}
                    </p>
                  );
                })()
              ) : null}
              {params.imp === "erro" ? (
                <p className="mx-5 mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {params.motivo ?? "Não consegui importar agora."}
                </p>
              ) : null}

              {docs.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p className="mb-1 font-medium text-fysi-deep">
                    {q || filtro !== "todos"
                      ? "Nenhum briefing com esse filtro"
                      : "Nenhum briefing ainda"}
                  </p>
                  <p className="mx-auto max-w-md text-sm text-fysi-muted">
                    {q || filtro !== "todos"
                      ? "Tente outro termo ou volte pra “Todos”."
                      : acessoTotal
                        ? "Use “Sincronizar do ClickUp” acima pra trazer os briefings que já existem lá, ou “+ Novo briefing” na lateral."
                        : "Os briefings aparecem aqui assim que a equipe importar."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden border-b border-fysi-line px-5 py-2 text-[0.68rem] uppercase tracking-[0.12em] text-fysi-muted md:grid md:grid-cols-[minmax(0,1fr)_10rem_7rem_5.5rem] md:gap-3">
                    <span>Briefing</span>
                    <span>Cliente</span>
                    <span>Estado</span>
                    <span className="text-right">Atualizado</span>
                  </div>
                  <ul className="divide-y divide-fysi-line">
                    {docs.map((d) => {
                      const r = d.clientId
                        ? resumoMateriais.get(d.clientId)
                        : undefined;
                      return (
                        <li key={d.id}>
                          <Link
                            href={`/admin/briefings/doc/${d.id}${keyParam}`}
                            className="flex flex-col gap-1 px-5 py-2.5 transition hover:bg-fysi-cream/60 md:grid md:grid-cols-[minmax(0,1fr)_10rem_7rem_5.5rem] md:items-center md:gap-3"
                          >
                            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-fysi-deep">
                                {d.titulo}
                              </span>
                              {d.isTemplate ? (
                                <span className="rounded-full border border-fysi-line bg-fysi-cream px-1.5 py-0.5 text-[0.68rem] font-medium text-fysi-muted">
                                  modelo
                                </span>
                              ) : null}
                              {d.compartilhado ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-fysi-mint px-1.5 py-0.5 text-[0.68rem] font-medium text-fysi-deep">
                                  <span className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
                                  link ativo
                                </span>
                              ) : null}
                              {d.temCredenciais ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[0.68rem] font-medium text-amber-800">
                                  tem acessos
                                </span>
                              ) : null}
                              {/* Material do cliente: é o que trava a landing
                                  page depois do briefing pronto. Só aparece
                                  quando FALTA algo — o selo verde "material
                                  completo" em toda linha era metade do ruído
                                  que fazia a lista antiga ser ilegível. */}
                              {r && r.total > 0 && r.faltam > 0 ? (
                                <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[0.68rem] font-medium text-amber-800">
                                  material: {fraseResumo(r)}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`truncate text-xs ${
                                d.clienteNome || d.isTemplate
                                  ? "text-fysi-muted"
                                  : "text-amber-700"
                              }`}
                            >
                              {d.clienteNome ??
                                (d.isTemplate ? "" : "sem cliente vinculado")}
                            </span>
                            <span className="hidden truncate text-xs text-fysi-muted md:block">
                              {estadoDe(d)}
                              {d.origem === "clickup" ? " · ClickUp" : ""}
                            </span>
                            <span className="text-xs tabular-nums text-fysi-muted md:text-right">
                              {dataCurta(d.updatedAt)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <div className="flex flex-col gap-1.5 px-5 py-4 text-xs text-fysi-muted">
                {contagem.avulsos > 0 && filtro === "todos" ? (
                  <p>
                    {contagem.avulsos} briefing
                    {contagem.avulsos === 1 ? "" : "s"} ainda sem cliente
                    vinculado — abra e escolha o cliente, ou deixe avulso se for
                    de alguém que não virou projeto.
                  </p>
                ) : null}
                {acessoTotal ? (
                  <p>
                    Sincronizar traz o conteúdo real de cada página do ClickUp —
                    caixinhas marcadas, links e referências — e atualiza o que
                    mudou lá, sem duplicar. Senhas de domínio e hospedagem são
                    separadas do corpo e ficam fora do link público.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {/* ================= MODELOS ================= */}
          {aba === "modelos" ? (
            templates.length === 0 ? (
              <p className="px-5 py-16 text-center text-sm text-fysi-muted">
                Nenhum modelo de perguntas criado ainda.
              </p>
            ) : (
              <ul className="divide-y divide-fysi-line">
                {templates.map((t) => (
                  /* O form de apagar fica FORA do <Link>: âncora não pode
                     conter formulário, e o navegador desmonta a árvore se
                     conter. Karine (01/10), sobre os quatro "teste" com
                     zero perguntas: "está bagunçado". */
                  <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-fysi-cream/60 transition">
                    <Link
                      href={`/admin/briefings/${t.id}${keyParam}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fysi-deep">
                        {t.nome}
                      </span>
                      <span className="text-xs text-fysi-muted">
                        {t.perguntas.length} pergunta
                        {t.perguntas.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs font-medium text-fysi-deep">
                        Editar e aplicar →
                      </span>
                    </Link>
                    <form action={deleteBriefingTemplateAction}>
                      {urlKey ? (
                        <input type="hidden" name="key" value={urlKey} />
                      ) : null}
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitTextButton
                        danger
                        confirm={`Apagar o modelo “${t.nome}”? Não dá pra desfazer.`}
                        pendingLabel="…"
                      >
                        Apagar
                      </SubmitTextButton>
                    </form>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {/* ================= PREENCHIDOS PELO CLIENTE ================= */}
          {aba === "respostas" ? (
            clients.length === 0 ? (
              <p className="px-5 py-16 text-center text-sm text-fysi-muted">
                {q
                  ? `Nenhum cliente encontrado para "${q}".`
                  : "Nenhum cliente cadastrado ainda."}
              </p>
            ) : (
              <ul className="divide-y divide-fysi-line">
                {clients.map((c) => {
                  const enviado = Boolean(c.briefing_submitted_at);
                  const emAndamento = (c.current_stage_index ?? 0) > 0;
                  const selo = enviado
                    ? { label: "enviado", cls: "bg-fysi-mint text-fysi-deep" }
                    : emAndamento
                      ? {
                          label: "em andamento",
                          cls: "border border-fysi-line bg-white text-fysi-deep",
                        }
                      : {
                          label: "aguardando",
                          cls: "border border-fysi-line bg-white text-fysi-muted",
                        };
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/admin/${c.id}?tab=briefing${
                          urlKey ? `&key=${encodeURIComponent(urlKey)}` : ""
                        }`}
                        className="flex flex-col gap-1 px-5 py-2.5 transition hover:bg-fysi-cream/60 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fysi-deep">
                          {c.empresa || c.nome || "Cliente sem nome"}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.68rem] font-medium ${selo.cls}`}
                        >
                          {selo.label}
                        </span>
                        <span className="truncate text-xs text-fysi-muted sm:w-56">
                          {c.email ?? ""}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-fysi-deep">
                          Ver respostas →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
