import dynamicImport from "next/dynamic";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { Eyebrow } from "@/components/ui/pill";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess, hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { buildTimeline } from "@/lib/project-types";
import { blocosForProject } from "@/lib/briefing-schema";
import {
  BLOCO_LABELS,
  BLOCO_NUMBERS,
  fieldLabel,
  valueLabel,
  isFileField,
  isEmpty,
} from "@/lib/briefing-labels";
import type { ProjectType } from "@/lib/types";

import { MateriaisPainel } from "@/components/admin/materiais-painel";
import { ClientTabs, type ClientTab } from "@/components/admin/client-tabs";
import { createEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";
import {
  getClientDocument,
} from "@/lib/ei-documents-server";
import { EIView } from "@/components/admin/ei-view";


import { ProblemasEditor } from "@/components/admin/problemas-editor";
import { PaymentReceipts } from "@/components/admin/payment-receipts";
import type { PaymentReceipt } from "@/lib/payment-receipts";

import { listCustomQuestions } from "@/lib/custom-questions-server";
import type { Moodboard } from "@/lib/moodboard";
import type { EntregaDocumento } from "@/lib/entrega";
import { DeleteClientButton } from "@/components/admin/delete-client-button";
import { ClientPreviewButton } from "@/components/admin/client-preview-button";
import { CopyButton } from "@/components/admin/copy-button";
import { SubmitButton, SubmitTextButton } from "@/components/admin/submit-button";
import { StatusChanger } from "@/components/admin/status-changer";
import { OrigemEditor } from "@/components/admin/origem-editor";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { getServerEnv } from "@/lib/env";
import {
  resendClientLinkAction,
  createDriveFoldersAction,
  sendToClickupAction,
  setClientContractDataAction,
  setDriveLinksAction,
  setPaymentAction,
  setProjectTypeAction,
} from "./actions";
import { ProjectStageControls } from "@/components/admin/project-stage-controls";

import { listProjectTasks } from "@/lib/project-tasks-server";
import { TASK_STATUS_GROUP } from "@/lib/project-tasks";
import { formatDiaMes } from "@/lib/datas";

export const dynamic = "force-dynamic";

/**
 * Componentes pesados por aba, carregados sob demanda. A ficha do cliente
 * tem 10 abas mas renderiza UMA por vez — importar tudo de forma estática
 * mandava ContractCard (1300 linhas), TasksBoard (957), EntregaEditor (678)
 * e MoodboardEditor (447) no bundle de toda abertura, inclusive na aba
 * "geral", que não usa nenhum deles.
 */
const ContractCard = dynamicImport(() =>
  import("@/components/admin/contract-card").then((m) => m.ContractCard)
);
const TasksBoard = dynamicImport(() =>
  import("@/components/admin/tasks-board").then((m) => m.TasksBoard)
);
const EntregaEditor = dynamicImport(() =>
  import("@/components/admin/entrega-editor").then((m) => m.EntregaEditor)
);
const MoodboardEditor = dynamicImport(() =>
  import("@/components/admin/moodboard-editor").then((m) => m.MoodboardEditor)
);
const CustomQuestionsEditor = dynamicImport(() =>
  import("@/components/admin/custom-questions-editor").then((m) => m.CustomQuestionsEditor)
);


interface BriefingResponse {
  field_id: string;
  bloco_id: string;
  value: unknown;
}

interface BriefingFile {
  field_id: string;
  file_name: string;
  public_url: string;
  size_bytes: number | null;
  mime_type: string | null;
}

export default async function AdminClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const urlKey = sp.key ?? null;
  // Aba ativa — controla qual grupo de seções renderiza
  const validTabs: ClientTab[] = [
    "geral",
    "ei",
    "briefing",
    "tarefas",
    "contrato",
    "pagamentos",
    "entrega",
    "problemas",
    "drive",
    "moodboard",
  ];
  const tab: ClientTab = validTabs.includes(sp.tab as ClientTab)
    ? (sp.tab as ClientTab)
    : "geral";
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Contrato/Pagamentos são financeiros — "basico" (ex: designer) não vê
  // nem por URL direta, mesmo em projeto em que está marcado.
  if (
    (tab === "contrato" || tab === "pagamentos") &&
    !hasFinanceAccess(member)
  ) {
    redirect(`/admin/${id}${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  // "basico" só acessa clientes em que tem tarefa atribuída — mesmo por
  // URL direta, não só escondido da lista.
  const visibleIds = await getVisibleClientIds(member);
  if (visibleIds && !visibleIds.has(id)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  // Sempre que veio com ?key=, preserva nos links/forms (mesmo se cookie
  // também autenticou — cookie pode cair no próximo clique).
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();

  const [
    { data: client },
    { data: responses },
    { data: files },
    tasks,
    eiDoc,
    briefingDoc,
  ] = await Promise.all([
    service.from("clients").select("*").eq("id", id).maybeSingle(),
    service.from("briefing_responses").select("*").eq("client_id", id),
    service.from("briefing_files").select("*").eq("client_id", id),
    listProjectTasks(id),
    // Buscar, não criar: abrir a ficha não pode gerar documento. Era assim
    // que nasciam os 23 briefings em branco, clones byte a byte do Modelo.
    getClientDocument(id, "ei"),
    getClientDocument(id, "briefing"),
  ]);

  if (!client) {
    return (
      <Shell tone="cream">
        <ContentFrame size="md">
          <h1 className="fysi-display text-2xl mb-3">
            Cliente não encontrado.
          </h1>
          <Link
            href="/admin/clientes"
            className="text-sm text-fysi-deep hover:underline"
          >
            ← Voltar à lista
          </Link>
        </ContentFrame>
      </Shell>
    );
  }

  const byBloco = groupByBloco((responses as BriefingResponse[]) ?? []);
  const filesList: BriefingFile[] = (files as BriefingFile[]) ?? [];

  // Credenciais de acesso do cliente (pra admin compartilhar com ele).
  const env = getServerEnv();
  // Deriva a base URL do host do request — assim o link mágico sai com o
  // domínio que o admin está acessando (custom domain) em vez de cair no
  // NEXT_PUBLIC_APP_URL que pode estar setado pro domínio padrão da Vercel.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : env.appUrl;
  const entrarUrl = `${baseUrl}/entrar`;
  const accessCode = env.clientAccessCode;

  // Só LEITURA aqui. Antes havia um backfill preguiçoso que dava UPDATE no
  // meio do render: como o <Link> do Next faz prefetch, passar o mouse sobre
  // a lista de clientes já disparava a escrita, sem ninguém ter aberto a
  // ficha (ver [[feedback_get_routes_sem_efeito_colateral]]). Virou código
  // morto de qualquer forma — os três caminhos que criam cliente
  // (auth/start, cliente/contrato, createClientAction) já geram o slug.
  const magicSlug = (client as { magic_slug?: string | null }).magic_slug ?? null;
  const painelLink = magicSlug ? `${baseUrl}/painel/${magicSlug}` : null;

  // Resolve stages a partir do project_type. Se project_type estiver nulo,
  // mostra placeholder vazio.
  const etapas = client.project_type
    ? buildTimeline(client.project_type)
    : [];
  const currentStage = client.current_stage_index ?? 0;

  // Comprovantes só quando a aba de pagamentos está aberta — nas outras é
  // consulta desperdiçada.
  let recibos: PaymentReceipt[] = [];
  if (tab === "pagamentos") {
    const { data: recibosData } = await service
      .from("payment_receipts")
      .select("*")
      .eq("client_id", client.id)
      .order("pago_em", { ascending: false });
    recibos = (recibosData as PaymentReceipt[] | null) ?? [];
  }

  // Perguntas específicas cadastradas pra este cliente (bloco extra do briefing).
  const customQuestions = await listCustomQuestions(client.id);
  // Mapa field_id → rótulo, pra mostrar a pergunta (não o id) no briefing.
  const customLabels = new Map<string, string>(
    customQuestions.map((q) => [`perguntas-especificas.${q.id}`, q.label])
  );

  // --- Visualização do briefing preenchido ---
  // Blocos esperados, na ordem lógica do projeto. Mais quaisquer blocos com
  // respostas que não pertençam ao tipo atual (ex.: tipo mudou depois).
  const projectType = (client.project_type as ProjectType | null) ?? null;
  const blocosBase = projectType ? blocosForProject(projectType) : [];
  const baseIds = new Set(blocosBase.map((b) => b.id));
  const blocosExtras = [...byBloco.keys()]
    .filter((blocoId) => !baseIds.has(blocoId))
    .map((blocoId) => ({
      id: blocoId,
      numero: BLOCO_NUMBERS[blocoId] ?? 0,
      titulo: BLOCO_LABELS[blocoId] ?? blocoId,
    }));
  const blocosOrdenados = [...blocosBase, ...blocosExtras];

  // Conta campos efetivamente preenchidos (ignora vazios) por bloco.
  const camposPorBloco = new Map<string, number>();
  let camposPreenchidos = 0;
  for (const [blocoId, fields] of byBloco) {
    const n = fields.filter((f) => !isEmpty(f.value)).length;
    camposPorBloco.set(blocoId, n);
    camposPreenchidos += n;
  }
  const briefingVazio = camposPreenchidos === 0;

  // Badges por tab — status rápido visível na navegação.
  const totalBlocos = blocosOrdenados.length;
  const blocosPreenchidos = blocosOrdenados.filter((b) => (camposPorBloco.get(b.id) ?? 0) > 0).length;
  const totalPagamento = Number(client.pagamento_total ?? 0);
  const pagamentoPago = Number(client.pagamento_pago ?? 0);
  const pctPagamento = totalPagamento > 0 ? Math.round((pagamentoPago / totalPagamento) * 100) : null;

  const contratoStatus = client.contrato_status as string | null;

  // Texto que vai pro cliente pelo WhatsApp (é mensagem, não interface).
  const mensagemWhats = `Oi ${client.nome?.split(" ")[0] ?? ""}! Aqui é da Fysi.

Seu painel está pronto. Acesse direto:
${painelLink ?? `${entrarUrl} (WhatsApp ${client.whatsapp} + código ${accessCode})`}

Qualquer dúvida, é só responder por aqui.`;

  // Resumo de tarefas pra Visão geral.
  const keySuffix = keyParam ? `&${keyParam.slice(1)}` : "";
  const hojeSP = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const tarefasAbertas = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "ativo"
  );
  const tarefasAtrasadas = tarefasAbertas.filter(
    (t) => t.data_vencimento && t.data_vencimento < hojeSP
  ).length;
  const proximaTarefa =
    tarefasAbertas
      .filter((t) => t.data_vencimento && t.data_vencimento >= hojeSP)
      .sort((a, b) => a.data_vencimento!.localeCompare(b.data_vencimento!))[0] ??
    null;
  const tabBadges: import("@/components/admin/client-tabs").ClientTabBadges = {
    briefing: client.briefing_submitted_at
      ? { tone: "mint", label: "✓ enviado" }
      : briefingVazio
        ? { tone: "muted", label: "vazio" }
        : { tone: "yellow", label: `${blocosPreenchidos}/${totalBlocos}` },
    pagamentos:
      contratoStatus === "assinado"
        ? pctPagamento === 100
          ? { tone: "mint", label: "✓ pago" }
          : pctPagamento != null
            ? { tone: "yellow", label: `${pctPagamento}% pago` }
            : { tone: "mint", label: "✓ assinado" }
        : contratoStatus === "pendente"
          ? { tone: "amber", label: "pendente" }
          : contratoStatus === "rejeitado" || contratoStatus === "cancelado"
            ? { tone: "amber", label: contratoStatus }
            : client.contrato_dados
              ? { tone: "yellow", label: "rascunho" }
              : undefined,
    entrega: client.entrega_finalizada_at
      ? { tone: "mint", label: "✓ entregue" }
      : client.entrega_documento
        ? { tone: "yellow", label: "rascunho" }
        : undefined,
    moodboard: (() => {
      const m = client.moodboard_data as Moodboard | null;
      if (!m) return undefined;
      if (m.status === "aprovado") return { tone: "mint" as const, label: "✓ aprovado" };
      if (m.status === "enviado") return { tone: "yellow" as const, label: "enviado" };
      if (m.items?.length > 0) return { tone: "muted" as const, label: `${m.items.length} cards` };
      return undefined;
    })(),
    tarefas: (() => {
      if (tasks.length === 0) return undefined;
      const fechadas = tasks.filter(
        (t) => TASK_STATUS_GROUP[t.status] === "fechado"
      ).length;
      return fechadas === tasks.length
        ? { tone: "mint" as const, label: "✓ completo" }
        : { tone: "yellow" as const, label: `${fechadas}/${tasks.length}` };
    })(),
  };

  return (
    <AdminShell active="clientes" keyParam={keyParam} userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)} hideFinance={!hasFinanceAccess(member)}>
        <Link
          href={`/admin/clientes${keyParam}`}
          className="text-xs text-fysi-muted hover:text-fysi-deep mb-3 inline-block"
        >
          ← Clientes
        </Link>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <ClientTabs
            active={tab}
            clientId={client.id}
            keyParam={keyParam}
            badges={tabBadges}
            hideFinance={!hasFinanceAccess(member)}
          />
          <div className="flex-1 min-w-0 w-full">

        {/* Cabeçalho compacto, igual em todas as abas: quem é, como falar com
            ele e em que status o projeto está. Antes um cartão lateral com
            tipo/ClickUp/reenviar/excluir ocupava ~300px de altura em TODA
            aba e empurrava o conteúdo (tarefas, briefing) pra baixo da
            dobra; e o status — o dado mais consultado — só existia na aba
            Visão geral. */}
        <header className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card px-5 py-4 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-72">
              <form action={setProjectTypeAction}>
                <input type="hidden" name="clientId" value={client.id} />
                {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                <AutoSubmitSelect
                  name="projectType"
                  defaultValue={client.project_type ?? ""}
                  title="Tipo de projeto — salva ao escolher"
                  className={`-ml-1 rounded-[8px] border border-transparent hover:border-fysi-line focus:border-fysi-deep/40 bg-transparent px-1 py-0.5 text-[0.7rem] uppercase tracking-[0.14em] font-semibold cursor-pointer focus:outline-none ${
                    client.project_type ? "text-fysi-muted" : "text-amber-700"
                  }`}
                >
                  <option value="" disabled>
                    Definir tipo de projeto
                  </option>
                  <option value="landing-com-copy">Landing com copy</option>
                  <option value="landing-sem-copy">Landing sem copy</option>
                  <option value="site-completo">Site completo</option>
                  <option value="seo">SEO</option>
                  <option value="outro">Outro</option>
                </AutoSubmitSelect>
              </form>
              <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight text-fysi-deep mt-0.5 break-words">
                {client.empresa || client.nome}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fysi-muted">
                {client.empresa && client.nome ? (
                  <span className="text-fysi-deep">{client.nome}</span>
                ) : null}
                {whatsappHref(client.whatsapp) ? (
                  <a
                    href={whatsappHref(client.whatsapp)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir conversa no WhatsApp"
                    className="inline-flex items-center gap-1.5 hover:text-fysi-deep underline-offset-2 hover:underline"
                  >
                    <WhatsIcon />
                    {client.whatsapp}
                  </a>
                ) : client.whatsapp ? (
                  <span>{client.whatsapp}</span>
                ) : null}
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-fysi-deep underline-offset-2 hover:underline break-all"
                  >
                    <MailIcon />
                    {client.email}
                  </a>
                ) : null}
              </div>
              <div className="mt-2">
                <OrigemEditor
                  clientId={client.id}
                  urlKey={urlKey ?? undefined}
                  valorInicial={
                    (client as { como_conheceu?: string | null }).como_conheceu ??
                    null
                  }
                />
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[0.68rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
                  Status
                </span>
                <StatusChanger
                  clientId={client.id}
                  status={client.status}
                  urlKey={urlKey ?? undefined}
                />
              </div>
              <div className="flex flex-wrap items-start md:justify-end gap-2">
                {/* O preview abre o painel do cliente, que mostra contrato e
                    valores — mesmo corte das abas financeiras. */}
                {hasFinanceAccess(member) ? (
                  <ClientPreviewButton
                    clientId={client.id}
                    urlKey={urlKey ?? undefined}
                  />
                ) : null}
                {client.clickup_task_id ? (
                  <a
                    href={`https://app.clickup.com/t/${client.clickup_task_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full border border-fysi-deep/15 text-fysi-deep text-xs font-medium px-3 py-1.5 hover:bg-fysi-cream"
                  >
                    Abrir no ClickUp ↗
                  </a>
                ) : null}
                {/* Ações raras ou destrutivas ficam recolhidas — não competem
                    com o que se usa todo dia. */}
                {client.email || !client.clickup_task_id || hasFullAccess(member) ? (
                <details className="relative group/acoes">
                  <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer inline-flex items-center rounded-full border border-fysi-deep/15 text-fysi-deep text-xs font-medium px-3 py-1.5 hover:bg-fysi-cream select-none">
                    Mais ações
                    <span className="ml-1 text-fysi-muted group-open/acoes:rotate-180 transition-transform" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <div className="absolute z-20 left-0 md:left-auto md:right-0 mt-1.5 w-64 bg-white border border-fysi-line rounded-[14px] shadow-xl p-3 flex flex-col gap-2.5">
                    {client.email ? (
                      <form action={resendClientLinkAction}>
                        <input type="hidden" name="email" value={client.email} />
                        {urlKey ? (
                          <input type="hidden" name="key" value={urlKey} />
                        ) : null}
                        <SubmitTextButton
                          className="text-sm text-fysi-deep hover:underline text-left disabled:opacity-50"
                          pendingLabel="Enviando…"
                          savedLabel="Link reenviado ✓"
                        >
                          Reenviar link de acesso por e-mail
                        </SubmitTextButton>
                      </form>
                    ) : null}
                    {!client.clickup_task_id ? (
                      <form action={sendToClickupAction}>
                        <input type="hidden" name="clientId" value={client.id} />
                        {urlKey ? (
                          <input type="hidden" name="key" value={urlKey} />
                        ) : null}
                        <SubmitTextButton
                          className="text-sm text-fysi-deep hover:underline text-left disabled:opacity-50"
                          pendingLabel="Enviando…"
                          savedLabel="Enviado ao ClickUp ✓"
                        >
                          Enviar briefing ao ClickUp
                        </SubmitTextButton>
                      </form>
                    ) : null}
                    {/* O servidor só deixa apagar com acesso total; mostrar o
                        botão pra quem não pode só levava a um redirect mudo. */}
                    {hasFullAccess(member) ? (
                      <div className="border-t border-fysi-line pt-2.5">
                        <DeleteClientButton
                          clientId={client.id}
                          clientName={client.empresa || client.nome}
                          urlKey={urlKey ?? undefined}
                        />
                      </div>
                    ) : null}
                  </div>
                </details>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {tab === "geral" ? (
        <>
        {/* Resumo — o que a Visão geral promete no nome. Cada cartão leva
            pra aba dele. Substitui o bloco "Onde o cliente está", que
            repetia a etapa mostrada logo abaixo em "Andamento do projeto". */}
        <section
          aria-label="Resumo do projeto"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
        >
          <ResumoCard
            href={`/admin/${client.id}?tab=tarefas${keySuffix}`}
            titulo="Tarefas"
            valor={
              tasks.length === 0
                ? "Nenhuma"
                : `${tarefasAbertas.length} aberta${tarefasAbertas.length === 1 ? "" : "s"}`
            }
            detalhe={
              tasks.length === 0
                ? "Gerar do modelo ou adicionar"
                : tarefasAtrasadas > 0
                  ? `${tarefasAtrasadas} em atraso`
                  : proximaTarefa
                    ? `Próxima: ${proximaTarefa.titulo} · ${formatDiaMes(proximaTarefa.data_vencimento!)}`
                    : tarefasAbertas.length > 0
                      ? "Nenhuma com prazo"
                      : "Tudo concluído"
            }
            tom={
              tarefasAtrasadas > 0
                ? "alerta"
                : tasks.length > 0 && tarefasAbertas.length === 0
                  ? "ok"
                  : "neutro"
            }
          />
          <ResumoCard
            href={`/admin/${client.id}?tab=briefing${keySuffix}`}
            titulo="Briefing"
            valor={
              client.briefing_submitted_at
                ? "Enviado"
                : briefingVazio
                  ? "Não preenchido"
                  : `${blocosPreenchidos} de ${totalBlocos} blocos`
            }
            detalhe={
              client.briefing_submitted_at
                ? `em ${formatDate(client.briefing_submitted_at)}`
                : briefingVazio
                  ? "Cliente ainda não começou"
                  : "Em preenchimento"
            }
            tom={client.briefing_submitted_at ? "ok" : "neutro"}
          />
          {hasFinanceAccess(member) ? (
            <>
              <ResumoCard
                href={`/admin/${client.id}?tab=contrato${keySuffix}`}
                titulo="Contrato"
                valor={
                  contratoStatus === "assinado"
                    ? "Assinado"
                    : contratoStatus === "pendente"
                      ? "Aguardando assinatura"
                      : contratoStatus === "rejeitado"
                        ? "Rejeitado"
                        : contratoStatus === "cancelado"
                          ? "Cancelado"
                          : client.contrato_dados
                            ? "Rascunho"
                            : "Não enviado"
                }
                detalhe={
                  contratoStatus === "assinado"
                    ? "PDF assinado na aba Contrato"
                    : contratoStatus === "pendente"
                      ? "Link enviado ao cliente"
                      : "Preencher e enviar"
                }
                tom={
                  contratoStatus === "assinado"
                    ? "ok"
                    : contratoStatus === "rejeitado" || contratoStatus === "cancelado"
                      ? "alerta"
                      : "neutro"
                }
              />
              <ResumoCard
                href={`/admin/${client.id}?tab=pagamentos${keySuffix}`}
                titulo="Pagamento"
                valor={
                  totalPagamento > 0
                    ? `${pctPagamento}% recebido`
                    : "Sem valor definido"
                }
                detalhe={
                  totalPagamento > 0
                    ? `${formatMoney(pagamentoPago)} de ${formatMoney(totalPagamento)}`
                    : "Informar o total do projeto"
                }
                tom={pctPagamento === 100 ? "ok" : "neutro"}
              />
            </>
          ) : null}
        </section>

        {/* Link de acesso pro cliente — pra mandar via WhatsApp.
            Fora do alcance do papel "basico": o link abre o painel do
            cliente (que mostra contrato e valores) e o bloco expõe o código
            de acesso GLOBAL, que entra como qualquer cliente. Designer via
            os dois só por estar marcada numa tarefa do projeto. */}
        {hasFinanceAccess(member) ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
          <Eyebrow>Acesso do cliente</Eyebrow>

          {painelLink ? (
            <div className="mt-3 bg-fysi-mint/40 border border-fysi-mint-vivid/40 rounded-[12px] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-fysi-deep font-medium mb-2">
                Link direto (sem senha)
              </p>
              <div className="flex items-center gap-2 mb-2">
                <a
                  href={painelLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fysi-deep underline break-all text-sm flex-1"
                >
                  {painelLink}
                </a>
                <CopyButton value={painelLink} label="Copiar link" />
              </div>
              <p className="text-xs text-fysi-muted">
                Mande esse link pelo WhatsApp. Cliente clica e cai direto no
                painel dele — sem precisar de código.
              </p>
            </div>
          ) : (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-[12px] p-4">
              <p className="text-xs text-amber-800 leading-relaxed">
                O link direto deste cliente ainda não foi gerado. Recarregue
                a página — ele é criado automaticamente. Se continuar assim,
                o cliente pode entrar normalmente pelo código de acesso em{" "}
                <span className="font-mono">/entrar</span>.
              </p>
            </div>
          )}

          {/* Link direto do briefing + Drive — acesso rápido */}
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {painelLink ? (
              <div className="bg-fysi-cream/50 border border-fysi-line rounded-[12px] p-3">
                <p className="text-[0.72rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold mb-1.5">
                  Link do briefing
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={`${painelLink}?ir=briefing`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fysi-green underline text-xs flex-1 font-mono truncate"
                  >
                    …/painel/…?ir=briefing
                  </a>
                  <CopyButton
                    value={`${painelLink}?ir=briefing`}
                    label="Copiar"
                  />
                </div>
                <p className="text-[0.74rem] text-fysi-muted mt-1.5">
                  Cliente cai direto no briefing dele.
                </p>
              </div>
            ) : null}

            {client.fysi_drive_link || client.cliente_drive_link ? (
              <div className="bg-fysi-cream/50 border border-fysi-line rounded-[12px] p-3">
                <p className="text-[0.72rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold mb-1.5">
                  Drive
                </p>
                <div className="flex flex-col gap-1">
                  {client.fysi_drive_link ? (
                    <a
                      href={client.fysi_drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fysi-green underline text-xs"
                    >
                      Pasta da Fysi →
                    </a>
                  ) : null}
                  {client.cliente_drive_link ? (
                    <a
                      href={client.cliente_drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fysi-green underline text-xs"
                    >
                      Materiais do cliente →
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <details className="text-sm mt-4">
            <summary className="cursor-pointer text-fysi-deep font-medium hover:text-fysi-green">
              Acesso por código (alternativo)
            </summary>
            <div className="grid sm:grid-cols-3 gap-3 bg-fysi-cream/40 rounded-[12px] p-4 mt-3">
              <div>
                <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                  Link
                </span>
                <a
                  href={entrarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fysi-deep underline break-all text-sm"
                >
                  {entrarUrl}
                </a>
              </div>
              <div>
                <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                  WhatsApp
                </span>
                <code className="font-mono text-fysi-deep text-sm">
                  {client.whatsapp}
                </code>
              </div>
              <div>
                <span className="text-fysi-muted text-xs uppercase tracking-[0.1em] block">
                  Código
                </span>
                <code className="font-mono text-fysi-deep text-sm">
                  {accessCode}
                </code>
              </div>
            </div>
          </details>

          {/* Aberta por padrão e com botões: era um <pre> dentro de um
              <details> fechado — pra usar, a pessoa abria, selecionava o
              texto na mão, copiava e ia pro WhatsApp colar. */}
          <div className="mt-4 border-t border-fysi-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-[0.72rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
                Mensagem pronta pra WhatsApp
              </p>
              <div className="flex items-center gap-2">
                <CopyButton value={mensagemWhats} label="Copiar mensagem" />
                {whatsappHref(client.whatsapp) ? (
                  <a
                    href={`${whatsappHref(client.whatsapp)}?text=${encodeURIComponent(mensagemWhats)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full border border-fysi-deep/15 text-fysi-deep text-xs font-medium px-3 py-1.5 hover:bg-fysi-cream whitespace-nowrap"
                  >
                    Abrir no WhatsApp ↗
                  </a>
                ) : null}
              </div>
            </div>
            <pre className="bg-fysi-cream/40 border border-fysi-line rounded-[12px] p-3 text-xs whitespace-pre-wrap font-sans text-fysi-deep">
              {mensagemWhats}
            </pre>
          </div>
        </section>
        ) : null}

        {/* Andamento do projeto — etapa clicável + marcadores + link da copy */}
        <ProjectStageControls
          clientId={client.id}
          urlKey={urlKey ?? undefined}
          etapas={etapas.map((e) => ({ titulo: e.titulo }))}
          currentStage={currentStage}
          chamadaFeita={!!client.chamada_agendada_at}
          briefingConcluido={!!client.briefing_submitted_at}
          copyReviewLink={
            (client as { copy_review_link?: string | null }).copy_review_link ??
            ""
          }
        />

        {/* Dados do cliente — editáveis pelo admin (pra contrato).
            CPF, RG e endereço: a ESCRITA já exigia acesso financeiro
            (requireClientFinanceAccess), mas a LEITURA não — o formulário
            aparecia preenchido pro papel "basico", e salvar só redirecionava
            em silêncio. */}
        {hasFinanceAccess(member) ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
          <Eyebrow>Dados do cliente (para contrato)</Eyebrow>
          <p className="text-sm text-fysi-muted mt-1 mb-4">
            Edite aqui os dados que vão no contrato. Se preencher e-mail, CPF
            e endereço, a Etapa &ldquo;Dados pra contrato&rdquo; do cliente
            é marcada como concluída.
          </p>
          <form
            action={setClientContractDataAction}
            className="grid sm:grid-cols-2 gap-3"
          >
            <input type="hidden" name="clientId" value={client.id} />
            {urlKey ? (
              <input type="hidden" name="key" value={urlKey} />
            ) : null}

            <FieldInput
              label="Nome completo"
              name="nome"
              defaultValue={client.nome ?? ""}
              required
              colSpan={2}
            />
            <FieldInput
              label="E-mail"
              name="email"
              type="email"
              defaultValue={client.email ?? ""}
              placeholder="exemplo@cliente.com"
            />
            <FieldInput
              label="Empresa"
              name="empresa"
              defaultValue={client.empresa ?? ""}
            />
            <FieldInput
              label="Endereço completo"
              name="endereco"
              defaultValue={client.endereco ?? ""}
              placeholder="Rua, número, bairro, cidade, estado"
              colSpan={2}
            />
            <FieldInput
              label="CEP"
              name="cep"
              defaultValue={client.cep ?? ""}
              placeholder="00000-000"
            />
            <FieldInput
              label="CPF"
              name="cpf"
              defaultValue={client.cpf ?? ""}
              placeholder="000.000.000-00"
            />
            <FieldInput
              label="RG (opcional)"
              name="rg"
              defaultValue={client.rg ?? ""}
            />
            <FieldInput
              label="CNPJ (opcional)"
              name="cnpj"
              defaultValue={client.cnpj ?? ""}
              placeholder="00.000.000/0001-00"
            />
            <FieldInput
              label="Razão social (opcional)"
              name="razao_social"
              defaultValue={client.razao_social ?? ""}
              colSpan={2}
            />

            <div className="sm:col-span-2 pt-2">
              <SubmitButton size="sm" variant="secondary">
                Salvar dados do cliente
              </SubmitButton>
            </div>
          </form>
        </section>
        ) : null}
        </>
        ) : null}

        {tab === "ei" ? (
          eiDoc ? (
            <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Eyebrow>Estrutura Inicial</Eyebrow>
                <Link
                  href={`/admin/estruturas-iniciais/${eiDoc.id}${keyParam}`}
                  className="text-sm font-medium text-fysi-deep hover:text-fysi-deep/70 whitespace-nowrap"
                >
                  Abrir em tela cheia →
                </Link>
              </div>
              {/* Editável aqui dentro, como a aba Briefing. Antes esta aba
                  era só um botão que jogava a pessoa pra outra tela — ler a
                  EI enquanto se mexe nas tarefas do cliente era impossível. */}
              <div className="mt-4">
                <EIView
                  docId={eiDoc.id}
                  urlKey={urlKey}
                  initialBlocks={eiDoc.blocks}
                  atualizadoAt={eiDoc.updatedAt}
                />
              </div>
            </section>
          ) : (
            <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center">
              <p className="text-fysi-deep font-medium">
                Nenhuma Estrutura Inicial ainda.
              </p>
              <p className="text-sm text-fysi-muted mt-1 max-w-md mx-auto">
                É onde ficam as decisões de estrutura da página antes de o
                design começar. Nasce do Modelo.
              </p>
              <form action={createEIDocumentAction}>
                <input type="hidden" name="clientId" value={client.id} />
                {urlKey ? (
                  <input type="hidden" name="key" value={urlKey} />
                ) : null}
                <SubmitTextButton
                  className="inline-flex items-center gap-2 mt-4 rounded-full bg-fysi-mint border border-fysi-mint-vivid text-fysi-deep text-sm font-semibold px-4 py-2 disabled:opacity-50"
                  pendingLabel="Criando…"
                >
                  Criar a partir do Modelo
                </SubmitTextButton>
              </form>
            </section>
          )
        ) : null}

        {tab === "moodboard" ? (
        <>
        {magicSlug ? (
          <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
            <Eyebrow>Compartilhar com o cliente</Eyebrow>
            <p className="text-xs text-fysi-muted mt-1 mb-3">
              Página pública do moodboard — mande pro cliente ver as
              referências.
            </p>
            <div className="flex items-center gap-2 bg-fysi-mint/40 border border-fysi-mint-vivid/40 rounded-[12px] p-3">
              <a
                href={`${baseUrl}/moodboard/${magicSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fysi-deep underline break-all text-sm flex-1"
              >
                {`${baseUrl}/moodboard/${magicSlug}`}
              </a>
              <CopyButton
                value={`${baseUrl}/moodboard/${magicSlug}`}
                label="Copiar link"
              />
            </div>
            <p className="text-[0.7rem] text-fysi-muted mt-2">
              O cliente só vê depois que o moodboard sair do rascunho
              (enviado/aprovado).
            </p>
          </section>
        ) : null}
        <MoodboardEditor
          clientId={client.id}
          urlKey={urlKey ?? null}
          initial={(client.moodboard_data as Moodboard | null) ?? null}
          atualizadoAt={client.moodboard_atualizado_at ?? null}
        />
        </>
        ) : null}

        {tab === "entrega" ? (
        <>
        {magicSlug ? (
          <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
            <Eyebrow>Compartilhar com o cliente</Eyebrow>
            <p className="text-xs text-fysi-muted mt-1 mb-3">
              Página pública do Documento de Entrega — o cliente abre e baixa
              em PDF.
            </p>
            <div className="flex items-center gap-2 bg-fysi-mint/40 border border-fysi-mint-vivid/40 rounded-[12px] p-3">
              <a
                href={`${baseUrl}/entrega/${magicSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fysi-deep underline break-all text-sm flex-1"
              >
                {`${baseUrl}/entrega/${magicSlug}`}
              </a>
              <CopyButton
                value={`${baseUrl}/entrega/${magicSlug}`}
                label="Copiar link"
              />
            </div>
            {!client.entrega_finalizada_at ? (
              <p className="text-[0.7rem] text-amber-700 mt-2">
                A entrega só aparece pro cliente depois que você finalizar
                abaixo.
              </p>
            ) : null}
          </section>
        ) : null}
        <EntregaEditor
          clientId={client.id}
          clientName={client.nome ?? null}
          empresa={client.empresa ?? null}
          urlKey={urlKey ?? null}
          initial={
            (client.entrega_documento as EntregaDocumento | null) ?? null
          }
          finalizadaAt={client.entrega_finalizada_at ?? null}
        />
        </>
        ) : null}

        {/* Contrato sempre visível em Visão geral E Financeiro — é a peça
            mais crítica da operação, não pode ficar atrás de aba. */}
        {tab === "contrato" ? (
          <ContractCard
            clientId={client.id}
            clientName={client.nome ?? null}
            clientEmail={client.email ?? null}
            clientEmpresa={client.empresa ?? null}
            clientRazaoSocial={client.razao_social ?? null}
            clientCnpj={client.cnpj ?? null}
            autentiqueDocumentId={client.autentique_document_id ?? null}
            contratoStatus={client.contrato_status ?? null}
            contratoSignedUrl={client.contrato_signed_url ?? null}
            contratoLinkAssinatura={client.contrato_link_assinatura ?? null}
            contratoDados={
              (client.contrato_dados as Record<string, unknown> | null) ?? null
            }
            urlKey={urlKey ?? undefined}
          />
        ) : null}

        {tab === "pagamentos" ? (
        <>
        {/* Pagamento — admin acompanha o quanto já foi recebido */}
        {(() => {
          const total = Number(client.pagamento_total ?? 0);
          const pago = Number(client.pagamento_pago ?? 0);
          const pendente = Math.max(0, total - pago);
          const pct =
            total > 0 ? Math.min(100, Math.round((pago / total) * 100)) : 0;
          return (
            <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
              <div className="flex items-baseline justify-between mb-4">
                <Eyebrow>Pagamento</Eyebrow>
                {total > 0 ? (
                  <span className="text-xs text-fysi-muted">
                    {pct}% recebido
                  </span>
                ) : null}
              </div>

              {total > 0 ? (
                <>
                  <div className="grid sm:grid-cols-3 gap-4 mb-3">
                    <div>
                      <span className="block text-[0.72rem] uppercase tracking-[0.12em] text-fysi-muted">
                        Total
                      </span>
                      <span className="text-fysi-deep font-medium">
                        {formatMoney(total)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[0.72rem] uppercase tracking-[0.12em] text-fysi-muted">
                        Pago
                      </span>
                      <span className="text-fysi-deep font-medium">
                        {formatMoney(pago)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[0.72rem] uppercase tracking-[0.12em] text-fysi-muted">
                        Pendente
                      </span>
                      <span
                        className={
                          pendente === 0
                            ? "text-fysi-deep font-medium"
                            : "text-amber-700 font-medium"
                        }
                      >
                        {formatMoney(pendente)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-fysi-line overflow-hidden mb-5">
                    <div
                      className="h-full bg-fysi-deep transition-[width]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-fysi-muted mb-4">
                  Preencha o valor total e o que já foi pago. O cliente vê isso
                  no painel dele.
                </p>
              )}

              <form
                action={setPaymentAction}
                className="grid sm:grid-cols-2 gap-3"
              >
                <input type="hidden" name="clientId" value={client.id} />
                {urlKey ? (
                  <input type="hidden" name="key" value={urlKey} />
                ) : null}
                <div className="flex flex-col gap-1">
                  <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                    Valor total (R$)
                  </label>
                  <input
                    type="text"
                    name="pagamentoTotal"
                    defaultValue={total > 0 ? total.toFixed(2).replace(".", ",") : ""}
                    inputMode="decimal"
                    placeholder="1800,00"
                    className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                    Já pago (R$)
                  </label>
                  <input
                    type="text"
                    name="pagamentoPago"
                    defaultValue={pago > 0 ? pago.toFixed(2).replace(".", ",") : ""}
                    inputMode="decimal"
                    placeholder="900,00"
                    className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                    Observação (opcional)
                  </label>
                  <input
                    type="text"
                    name="pagamentoObservacao"
                    defaultValue={client.pagamento_observacao ?? ""}
                    placeholder="Ex: 50% sinal recebido 27/05, restante até 15/06"
                    className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <SubmitButton size="sm" variant="secondary">
                    Salvar pagamento
                  </SubmitButton>
                  {client.pagamento_atualizado_at ? (
                    <span className="text-[0.72rem] text-fysi-muted">
                      Atualizado em {formatDate(client.pagamento_atualizado_at)}
                    </span>
                  ) : null}
                </div>
              </form>
            </section>
          );
        })()}

        <PaymentReceipts
          clientId={client.id}
          urlKey={urlKey ?? undefined}
          recibos={recibos}
          pagamentoPago={Number(client.pagamento_pago ?? 0)}
          formatMoney={formatMoney}
          formatDateShort={formatDate}
        />
        </>
        ) : null}

        {tab === "drive" ? (
        /* Drive — links manuais (Fysi + cliente) */
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
          <Eyebrow>Drive</Eyebrow>

          <div className="mt-4 flex flex-col gap-5">
            <form
              action={setDriveLinksAction}
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="clientId" value={client.id} />
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                Pasta da Fysi
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="fysiDriveLink"
                  defaultValue={client.fysi_drive_link ?? ""}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                />
                <SubmitButton size="sm" variant="secondary">
                  Salvar
                </SubmitButton>
              </div>
              <p className="text-[0.72rem] text-fysi-muted">
                Pasta criada no Drive da Fysi pra esse cliente. O cliente
                também vê esse link no painel dele.
                {client.google_drive_folders ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-fysi-deep font-medium">
                    · ✓ auto-criada
                  </span>
                ) : null}
              </p>
              {client.fysi_drive_link ? (
                <a
                  href={client.fysi_drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-fysi-deep underline underline-offset-2 hover:text-fysi-green"
                >
                  Abrir pasta da Fysi →
                </a>
              ) : null}
            </form>
            {!client.google_drive_folders ? (
              <form action={createDriveFoldersAction} className="flex flex-col gap-1.5 -mt-2">
                <input type="hidden" name="clientId" value={client.id} />
                {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                <SubmitButton size="sm" variant="secondary" pendingLabel="Criando pasta…">
                  Criar pasta automaticamente no Drive
                </SubmitButton>
                <p className="text-[0.72rem] text-fysi-muted">
                  Cria a estrutura de pastas na pasta da Fysi no Drive e
                  preenche o link acima sozinho.
                </p>
              </form>
            ) : null}

            <form
              action={setDriveLinksAction}
              className="flex flex-col gap-2 border-t border-fysi-line pt-4"
            >
              <input type="hidden" name="clientId" value={client.id} />
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                Drive do cliente (materiais dele)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="clienteDriveLink"
                  defaultValue={client.cliente_drive_link ?? ""}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                />
                <SubmitButton size="sm" variant="secondary">
                  Salvar
                </SubmitButton>
              </div>
              <p className="text-[0.72rem] text-fysi-muted">
                Pasta Drive que o cliente já tem com logos, fotos, etc.
              </p>
              {client.cliente_drive_link ? (
                <a
                  href={client.cliente_drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-fysi-deep underline underline-offset-2 hover:text-fysi-green"
                >
                  Abrir pasta do cliente →
                </a>
              ) : null}
            </form>
          </div>
        </section>
        ) : null}

        {tab === "problemas" ? (
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
          <Eyebrow>Mapeamento de problemas</Eyebrow>
          <h2 className="text-lg font-medium text-fysi-deep mt-1 mb-4">
            Bloco de notas
          </h2>
          <ProblemasEditor clientId={client.id} urlKey={urlKey ?? undefined} />
        </section>
        ) : null}

        {tab === "briefing" ? (
        <>
        {/* Documento de briefing — preenchido junto com o cliente durante a
            call, estilo Notion/ClickUp (mesmo editor de blocos da Estrutura
            Inicial). Pedido do usuário 2026-08-31, ver referência real em
            https://app.clickup.com/31006509/docs/xj7td-41071. */}
        {briefingDoc ? (
          <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Eyebrow>Briefing — documento da call</Eyebrow>
              {/* O briefing tem vida própria fora da ficha: é lá que fica o
                  link público, que abre só este documento e não dá acesso a
                  contrato, valores nem ao resto do cliente. */}
              <Link
                href={`/admin/briefings/doc/${briefingDoc.id}${
                  urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""
                }`}
                className="text-sm font-medium text-fysi-deep hover:text-fysi-deep/70 whitespace-nowrap"
              >
                Abrir e compartilhar →
              </Link>
            </div>
            <div className="mt-4">
              <EIView
                docId={briefingDoc.id}
                urlKey={urlKey}
                initialBlocks={briefingDoc.blocks}
                atualizadoAt={briefingDoc.updatedAt}
              />
            </div>
          </section>
        ) : (
          <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6 text-center">
            <p className="text-fysi-deep font-medium">
              Sem documento de briefing ainda
            </p>
            <p className="text-sm text-fysi-muted mt-1 max-w-md mx-auto">
              É o documento preenchido junto com o cliente na call, a partir
              do Modelo. Ele ganha link próprio pra compartilhar.
            </p>
            <form action={createEIDocumentAction}>
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="kind" value="briefing" />
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <SubmitTextButton
                className="inline-flex items-center gap-2 mt-4 rounded-full bg-fysi-mint border border-fysi-mint-vivid text-fysi-deep text-sm font-semibold px-4 py-2 disabled:opacity-50"
                pendingLabel="Criando…"
              >
                Criar a partir do Modelo
              </SubmitTextButton>
            </form>
          </section>
        )}

        {/* Resumo de preenchimento do briefing (formulário que o cliente preenche sozinho) */}
        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <Eyebrow>Preenchimento do briefing</Eyebrow>
            <span className="text-xs text-fysi-muted">
              {camposPreenchidos}{" "}
              {camposPreenchidos === 1 ? "campo preenchido" : "campos preenchidos"}
              {filesList.length > 0
                ? ` · ${filesList.length} ${
                    filesList.length === 1 ? "arquivo" : "arquivos"
                  }`
                : ""}
            </span>
          </div>

          {blocosOrdenados.length > 0 ? (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {blocosOrdenados.map((bloco) => {
                const n = camposPorBloco.get(bloco.id) ?? 0;
                const feito = n > 0;
                return (
                  <li key={bloco.id}>
                    {/* Âncora: o resumo vira navegação do documento, como o
                        índice de um doc do ClickUp. Antes era só enfeite e
                        obrigava a rolar a página inteira pra achar um bloco. */}
                    <a
                      href={`#bloco-${bloco.id}`}
                      className={`block rounded-[12px] border px-3 py-2 transition hover:border-fysi-mint-vivid ${
                      feito
                        ? "bg-fysi-mint border-fysi-mint-vivid/40"
                        : "bg-fysi-cream/40 border-fysi-line"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          feito ? "bg-fysi-deep" : "bg-fysi-line-strong"
                        }`}
                      />
                      <span className="text-sm text-fysi-deep font-medium">
                        {bloco.titulo}
                      </span>
                    </span>
                    <span className="block pl-4 text-xs text-fysi-muted mt-0.5">
                      {feito
                        ? `${n} ${n === 1 ? "campo" : "campos"}`
                        : "Pendente"}
                    </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-fysi-muted">
              Tipo de projeto ainda não definido — sem blocos pra exibir.
            </p>
          )}
        </section>

        {/* Respostas detalhadas, bloco a bloco */}
        {briefingVazio ? (
          <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-8 text-center">
            <p className="text-fysi-deep font-medium mb-1">
              Briefing ainda não preenchido
            </p>
            <p className="text-sm text-fysi-muted">
              Este cliente ainda não enviou nenhuma resposta do briefing.
            </p>
          </section>
        ) : (
          <div className="flex flex-col gap-6">
            {blocosOrdenados.map((bloco) => {
              const fields = (byBloco.get(bloco.id) ?? []).filter(
                (f) => !isEmpty(f.value)
              );
              return (
                <section
                  key={bloco.id}
                  id={`bloco-${bloco.id}`}
                  className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 scroll-mt-24"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <Eyebrow>
                      {bloco.numero ? `Bloco ${bloco.numero} · ` : ""}
                      {bloco.titulo}
                    </Eyebrow>
                    <span className="text-xs text-fysi-muted shrink-0">
                      {fields.length > 0
                        ? `${fields.length} ${
                            fields.length === 1 ? "resposta" : "respostas"
                          }`
                        : "Não preenchido"}
                    </span>
                  </div>

                  {/* Grade: resposta curta ocupa metade da largura, texto
                      longo ocupa tudo. Empilhar tudo em coluna fazia um bloco
                      de 10 campos virar uma tela inteira de rolagem. */}
                  {fields.length > 0 ? (
                    <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                      {fields.map((f) => {
                        const bruto =
                          typeof f.value === "string" ? f.value : "";
                        const longo =
                          isFileField(f.value) || bruto.length > 90 || bruto.includes("\n");
                        return (
                          <div
                            key={f.field_id}
                            className={`border-b border-fysi-line pb-3 last:border-b-0 ${
                              longo ? "sm:col-span-2" : ""
                            }`}
                          >
                            <p className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium mb-1">
                              {customLabels.get(f.field_id) ?? fieldLabel(f.field_id)}
                            </p>
                            {renderFieldValue(f.field_id, f.value)}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-fysi-muted mt-3">
                      O cliente ainda não preencheu este bloco.
                    </p>
                  )}
                </section>
              );
            })}

            {filesList.length > 0 ? (
              <MateriaisPainel
                files={filesList}
                clientId={client.id}
                urlKey={urlKey}
              />
            ) : null}
          </div>
        )}

        {/* Configuração vem por último: quem abre a aba Briefing quer LER o
            briefing. O editor de perguntas extras ficava no topo e empurrava
            o documento e as respostas pra baixo. */}
          <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mt-6 flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-medium text-fysi-deep">
                Perguntas específicas
              </h3>
              <p className="text-sm text-fysi-muted mt-1">
                Perguntas sob medida pra este cliente. Aparecem como um bloco
                extra no briefing dele.
              </p>
            </div>
            <CustomQuestionsEditor
              clientId={client.id}
              urlKey={urlKey ?? undefined}
              questions={customQuestions}
            />
          </section>
        </>
        ) : null}

        {tab === "tarefas" ? (
          <TasksBoard
            clientId={client.id}
            urlKey={urlKey ?? undefined}
            projectType={(client.project_type as ProjectType | null) ?? null}
            tasks={tasks}
            restrictToResponsavel={
              member.role === "basico" ? member.taskValue : undefined
            }
          />
        ) : null}
          </div>
        </div>
    </AdminShell>
  );
}

/** wa.me pede DDI: número brasileiro digitado sem o 55 ganha o prefixo. */
function whatsappHref(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

function WhatsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

const RESUMO_TOM = {
  ok: "bg-fysi-mint-vivid",
  alerta: "bg-red-500",
  neutro: "bg-fysi-line-strong",
} as const;

/** Cartão do resumo da Visão geral — o cartão inteiro é o link pra aba. */
function ResumoCard({
  href,
  titulo,
  valor,
  detalhe,
  tom,
}: {
  href: string;
  titulo: string;
  valor: string;
  detalhe: string;
  tom: keyof typeof RESUMO_TOM;
}) {
  return (
    <Link
      href={href}
      className="group block bg-white border border-fysi-line rounded-[16px] shadow-fysi-card px-4 py-3.5 transition hover:border-fysi-deep/30"
    >
      <span className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
        <span className={`h-1.5 w-1.5 rounded-full ${RESUMO_TOM[tom]}`} />
        {titulo}
        <span className="ml-auto text-fysi-muted opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
          →
        </span>
      </span>
      <span
        className={`block mt-1.5 text-[0.95rem] font-semibold leading-snug ${
          tom === "alerta" ? "text-red-700" : "text-fysi-deep"
        }`}
      >
        {valor}
      </span>
      <span className="block mt-0.5 text-xs text-fysi-muted truncate" title={detalhe}>
        {detalhe}
      </span>
    </Link>
  );
}


function FieldInput({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  required,
  colSpan,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "sm:col-span-2" : ""}>
      <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium block mb-1">
        {label}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
      />
    </div>
  );
}

function groupByBloco(rows: BriefingResponse[]) {
  const map = new Map<string, BriefingResponse[]>();
  for (const r of rows) {
    const list = map.get(r.bloco_id) ?? [];
    list.push(r);
    map.set(r.bloco_id, list);
  }
  return map;
}

/**
 * Renderiza o valor de um campo da forma mais legível possível:
 * uploads viram links, categóricos viram a label humana, o resto vira texto.
 */
function renderFieldValue(fullFieldId: string, value: unknown): ReactNode {
  // Campo de upload — guarda [{ url, name, size, ... }]
  if (isFileField(value)) {
    const arquivos = value as Array<{ url: string; name: string }>;
    return (
      <ul className="flex flex-col gap-1">
        {arquivos.map((arq, i) => (
          <li key={i}>
            <a
              href={arq.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-fysi-deep underline underline-offset-2 hover:text-fysi-green break-words"
            >
              {arq.name}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  // Campo categórico (radio/select) — mostra a label humana.
  const human = valueLabel(fullFieldId, value);
  if (human) {
    return <span className="text-sm text-fysi-deep">{human}</span>;
  }

  // Texto livre / número / objeto.
  return (
    <pre className="text-sm text-fysi-deep whitespace-pre-wrap break-words font-sans">
      {renderValue(value)}
    </pre>
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value, null, 2);
}

function formatMoney(value: number): string {
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
    return "—";
  }
}
