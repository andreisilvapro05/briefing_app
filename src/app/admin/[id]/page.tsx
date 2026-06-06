import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { buildTimeline } from "@/lib/project-types";
import { blocosForProject } from "@/lib/briefing-schema";
import {
  BLOCO_LABELS,
  BLOCO_NUMBERS,
  PROJECT_TYPE_LABELS,
  fieldLabel,
  valueLabel,
  isFileField,
  isEmpty,
} from "@/lib/briefing-labels";
import type { ProjectType } from "@/lib/types";
import { ContractCard } from "@/components/admin/contract-card";
import { MateriaisPainel } from "@/components/admin/materiais-painel";
import { ClientTabs, type ClientTab } from "@/components/admin/client-tabs";
import { EIEditor } from "@/components/admin/ei-editor";
import type { EIData } from "@/lib/ei-template";
import { EntregaEditor } from "@/components/admin/entrega-editor";
import { MoodboardEditor } from "@/components/admin/moodboard-editor";
import type { Moodboard } from "@/lib/moodboard";
import type { EntregaDocumento } from "@/lib/entrega";
import { DeleteClientButton } from "@/components/admin/delete-client-button";
import { ClientPreviewButton } from "@/components/admin/client-preview-button";
import { CopyButton } from "@/components/admin/copy-button";
import { getServerEnv } from "@/lib/env";
import {
  resendClientLinkAction,
  sendToClickupAction,
  setClientContractDataAction,
  setClientStatusAction,
  setCopyReviewLinkAction,
  setDriveLinksAction,
  setPaymentAction,
  setProjectTypeAction,
  setStageAction,
  toggleBriefingConcluidoAction,
  toggleChamadaFeitaAction,
} from "./actions";
import { generateMagicSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

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
    "briefing",
    "moodboard",
    "financeiro",
    "entrega",
  ];
  const tab: ClientTab = validTabs.includes(sp.tab as ClientTab)
    ? (sp.tab as ClientTab)
    : "geral";
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  // Sempre que veio com ?key=, preserva nos links/forms (mesmo se cookie
  // também autenticou — cookie pode cair no próximo clique).
  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();

  const [{ data: client }, { data: responses }, { data: files }] =
    await Promise.all([
      service.from("clients").select("*").eq("id", id).maybeSingle(),
      service.from("briefing_responses").select("*").eq("client_id", id),
      service.from("briefing_files").select("*").eq("client_id", id),
    ]);

  if (!client) {
    return (
      <Shell tone="cream">
        <ContentFrame size="md">
          <h1 className="fysi-display text-2xl mb-3">
            Cliente não encontrado.
          </h1>
          <Link
            href="/admin"
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

  // Lazy backfill do magic_slug pra clientes antigos (criados antes da feature).
  // Se a migration ainda não foi rodada, o update falha e painelLink fica null
  // — a UI mostra aviso pra rodar a SQL em vez de um link quebrado.
  let magicSlug = (client as { magic_slug?: string | null }).magic_slug;
  let painelLink: string | null = null;
  if (magicSlug) {
    painelLink = `${baseUrl}/painel/${magicSlug}`;
  } else {
    const slug = generateMagicSlug({
      nome: client.nome,
      empresa: client.empresa,
    });
    const { error: slugErr } = await service
      .from("clients")
      .update({ magic_slug: slug })
      .eq("id", client.id);
    if (!slugErr) {
      magicSlug = slug;
      painelLink = `${baseUrl}/painel/${slug}`;
    }
  }

  // Resolve stages a partir do project_type. Se project_type estiver nulo,
  // mostra placeholder vazio.
  const etapas = client.project_type
    ? buildTimeline(client.project_type)
    : [];
  const currentStage = client.current_stage_index ?? 0;

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

  const headerLinha = [client.nome, client.email, client.whatsapp]
    .filter(Boolean)
    .join(" · ");

  // Badges por tab — status rápido visível na navegação.
  const totalBlocos = blocosOrdenados.length;
  const blocosPreenchidos = blocosOrdenados.filter((b) => (camposPorBloco.get(b.id) ?? 0) > 0).length;
  const totalPagamento = Number(client.pagamento_total ?? 0);
  const pagamentoPago = Number(client.pagamento_pago ?? 0);
  const pctPagamento = totalPagamento > 0 ? Math.round((pagamentoPago / totalPagamento) * 100) : null;

  const contratoStatus = client.contrato_status as string | null;
  const tabBadges: import("@/components/admin/client-tabs").ClientTabBadges = {
    briefing: client.briefing_submitted_at
      ? { tone: "mint", label: "✓ enviado" }
      : briefingVazio
        ? { tone: "muted", label: "vazio" }
        : { tone: "yellow", label: `${blocosPreenchidos}/${totalBlocos}` },
    financeiro:
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
  };

  return (
    <Shell
      tone="cream"
      sectionLabel={`Briefing · ${client.empresa || client.nome}`}
    >
      <ContentFrame size="xl">
        <Link
          href={`/admin${keyParam}`}
          className="text-xs text-fysi-muted hover:text-fysi-deep mb-3 inline-block"
        >
          ← Voltar à lista
        </Link>

        <header className="grid md:grid-cols-[2fr_1fr] gap-6 mb-6">
          <div>
            <Eyebrow>
              {client.project_type
                ? PROJECT_TYPE_LABELS[client.project_type] ??
                  client.project_type
                : "Tipo a definir"}
            </Eyebrow>
            <h1 className="fysi-display text-3xl md:text-4xl mt-2">
              {client.empresa || client.nome}
            </h1>
            <p className="text-fysi-muted text-sm mt-1">{headerLinha}</p>
          </div>

          <aside className="bg-white border border-fysi-line rounded-[16px] p-4 flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <form action={setProjectTypeAction} className="flex flex-col gap-1">
                <label className="text-[0.6rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  Tipo
                </label>
                <input type="hidden" name="clientId" value={client.id} />
                {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                <select
                  name="projectType"
                  defaultValue={client.project_type ?? ""}
                  className="text-xs rounded-[8px] border border-fysi-line bg-white px-2 py-1.5 text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                >
                  <option value="" disabled>
                    escolher
                  </option>
                  <option value="landing-com-copy">Landing com copy</option>
                  <option value="landing-sem-copy">Landing sem copy</option>
                  <option value="site-completo">Site completo</option>
                  <option value="seo">SEO</option>
                  <option value="outro">Outro</option>
                </select>
                <button
                  type="submit"
                  className="text-[0.65rem] text-fysi-deep hover:underline text-left"
                >
                  ↳ salvar tipo
                </button>
              </form>

              <form
                action={setClientStatusAction}
                className="flex flex-col gap-1"
              >
                <label className="text-[0.6rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
                  Status
                </label>
                <input type="hidden" name="clientId" value={client.id} />
                {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
                <select
                  name="status"
                  defaultValue={client.status}
                  className="text-xs rounded-[8px] border border-fysi-line bg-white px-2 py-1.5 text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                >
                  <option value="nao-iniciado">Não iniciado</option>
                  <option value="em-andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="abandonado">Abandonado</option>
                </select>
                <button
                  type="submit"
                  className="text-[0.65rem] text-fysi-deep hover:underline text-left"
                >
                  ↳ salvar status
                </button>
              </form>
            </div>

            {client.clickup_task_id ? (
              <div>
                <Eyebrow>ClickUp</Eyebrow>
                <p className="mt-1 text-xs text-fysi-deep">
                  Task: {client.clickup_task_id}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-fysi-line">
              {client.email ? (
                <form action={resendClientLinkAction}>
                  <input type="hidden" name="email" value={client.email} />
                  {urlKey ? (
                    <input type="hidden" name="key" value={urlKey} />
                  ) : null}
                  <Button type="submit" size="sm" variant="secondary">
                    Reenviar link
                  </Button>
                </form>
              ) : null}
              {!client.clickup_task_id ? (
                <form action={sendToClickupAction}>
                  <input type="hidden" name="clientId" value={client.id} />
                  {urlKey ? (
                    <input type="hidden" name="key" value={urlKey} />
                  ) : null}
                  <Button type="submit" size="sm" variant="primary">
                    Enviar ao ClickUp
                  </Button>
                </form>
              ) : null}
            </div>

            <div className="border-t border-fysi-line pt-3 flex flex-col gap-2">
              <ClientPreviewButton
                clientId={client.id}
                urlKey={urlKey ?? undefined}
              />
              <DeleteClientButton
                clientId={client.id}
                clientName={client.empresa || client.nome}
                urlKey={urlKey ?? undefined}
              />
            </div>
          </aside>
        </header>

        <ClientTabs
          active={tab}
          clientId={client.id}
          keyParam={keyParam}
          badges={tabBadges}
        />

        {tab === "geral" ? (
        <>
        {/* Link de acesso pro cliente — pra mandar via WhatsApp */}
        <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
          <Eyebrow>Acesso do cliente</Eyebrow>

          {painelLink ? (
            <div className="mt-3 bg-fysi-mint/40 border border-fysi-mint-vivid/40 rounded-[12px] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-fysi-deep font-medium mb-2">
                🔗 Link direto (sem senha)
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
              <p className="text-xs text-amber-800">
                ⚠️ Link sem senha ainda não disponível — rode a migration
                de <code className="font-mono">magic_slug</code> no Supabase
                pra ativar.
              </p>
            </div>
          )}

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

          <details className="text-sm mt-3">
            <summary className="cursor-pointer text-fysi-deep font-medium hover:text-fysi-green">
              📋 Mensagem pronta pra WhatsApp
            </summary>
            <pre className="mt-3 bg-fysi-cream/40 border border-fysi-line rounded-[12px] p-3 text-xs whitespace-pre-wrap font-sans text-fysi-deep">
{`Oi ${client.nome?.split(" ")[0] ?? ""}! Aqui é da Fysi 👋

Seu painel está pronto. Acesse direto:
${painelLink ?? `${entrarUrl} (WhatsApp ${client.whatsapp} + código ${accessCode})`}

Qualquer dúvida, é só responder por aqui.`}
            </pre>
          </details>
        </section>

        {/* Marcadores de fase (admin marca chamada/briefing como feitos) */}
        <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
          <Eyebrow>Fases do projeto (marcar como feito)</Eyebrow>
          <p className="text-sm text-fysi-muted mt-1 mb-4">
            O painel do cliente reflete o status que você define aqui.
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={toggleChamadaFeitaAction}>
              <input type="hidden" name="clientId" value={client.id} />
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <Button type="submit" size="sm" variant="secondary">
                {client.chamada_agendada_at
                  ? "✓ Chamada feita — desmarcar"
                  : "Marcar chamada como feita"}
              </Button>
            </form>
            <form action={toggleBriefingConcluidoAction}>
              <input type="hidden" name="clientId" value={client.id} />
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <Button type="submit" size="sm" variant="secondary">
                {client.briefing_submitted_at
                  ? "✓ Briefing concluído — desmarcar"
                  : "Marcar briefing como concluído"}
              </Button>
            </form>
          </div>

          <form
            action={setCopyReviewLinkAction}
            className="mt-5 pt-5 border-t border-fysi-line flex flex-col gap-2"
          >
            <input type="hidden" name="clientId" value={client.id} />
            {urlKey ? (
              <input type="hidden" name="key" value={urlKey} />
            ) : null}
            <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
              📝 Link de revisão da copy
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                name="copyReviewLink"
                defaultValue={
                  (client as { copy_review_link?: string | null })
                    .copy_review_link ?? ""
                }
                placeholder="https://docs.google.com/document/..."
                className="flex-1 rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
              />
              <Button type="submit" size="sm" variant="secondary">
                Salvar
              </Button>
            </div>
            <p className="text-[0.65rem] text-fysi-muted">
              Aparece pro cliente na etapa &ldquo;Criação da copy&rdquo; da timeline.
            </p>
          </form>
        </section>

        {/* Pipeline / stage management — só aparece se project_type definido */}
        {etapas.length > 0 ? (
          <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
            <div className="flex items-baseline justify-between mb-4">
              <Eyebrow>Pipeline do projeto</Eyebrow>
              <span className="text-xs text-fysi-muted">
                Stage {currentStage + 1} de {etapas.length}
              </span>
            </div>

            <ol className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
              {etapas.map((etapa, idx) => {
                const isDone = idx < currentStage;
                const isCurrent = idx === currentStage;
                return (
                  <li key={`${etapa.numero}-${etapa.titulo}`}>
                    <form action={setStageAction}>
                      <input
                        type="hidden"
                        name="clientId"
                        value={client.id}
                      />
                      <input type="hidden" name="target" value={String(idx)} />
                      {urlKey ? (
                        <input type="hidden" name="key" value={urlKey} />
                      ) : null}
                      <button
                        type="submit"
                        className={`w-full text-left rounded-[12px] border px-3 py-2 transition ${
                          isCurrent
                            ? "bg-fysi-deep text-fysi-cream border-fysi-deep"
                            : isDone
                              ? "bg-fysi-mint border-fysi-mint-vivid/40 text-fysi-deep"
                              : "bg-white border-fysi-line text-fysi-muted hover:border-fysi-deep/30 hover:text-fysi-deep"
                        }`}
                      >
                        <span className="block text-[0.65rem] uppercase tracking-[0.12em] font-medium opacity-70">
                          Etapa {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="block text-xs font-medium leading-tight mt-0.5">
                          {etapa.titulo}
                        </span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ol>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-fysi-line">
              <form action={setStageAction}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="direction" value="prev" />
                {urlKey ? (
                  <input type="hidden" name="key" value={urlKey} />
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  disabled={currentStage <= 0}
                >
                  ← Stage anterior
                </Button>
              </form>

              <span className="text-sm text-fysi-deep font-medium">
                {etapas[currentStage]?.titulo ?? "—"}
              </span>

              <form action={setStageAction}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="direction" value="next" />
                {urlKey ? (
                  <input type="hidden" name="key" value={urlKey} />
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={currentStage >= etapas.length - 1}
                >
                  Avançar stage →
                </Button>
              </form>
            </div>
          </section>
        ) : null}

        {/* Dados do cliente — editáveis pelo admin (pra contrato) */}
        <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
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
              <Button type="submit" size="sm" variant="secondary">
                Salvar dados do cliente
              </Button>
            </div>
          </form>
        </section>
        </>
        ) : null}

        {tab === "briefing" ? (
        <EIEditor
          clientId={client.id}
          clientName={client.nome ?? null}
          empresa={client.empresa ?? null}
          urlKey={urlKey ?? null}
          initial={(client.ei_data as EIData | null) ?? null}
          atualizadoAt={client.ei_atualizado_at ?? null}
        />
        ) : null}

        {tab === "moodboard" ? (
        <MoodboardEditor
          clientId={client.id}
          urlKey={urlKey ?? null}
          initial={(client.moodboard_data as Moodboard | null) ?? null}
          atualizadoAt={client.moodboard_atualizado_at ?? null}
        />
        ) : null}

        {tab === "entrega" ? (
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
        ) : null}

        {tab === "financeiro" ? (
        <>
        <ContractCard
          clientId={client.id}
          clientName={client.nome ?? null}
          clientEmail={client.email ?? null}
          autentiqueDocumentId={client.autentique_document_id ?? null}
          contratoStatus={client.contrato_status ?? null}
          contratoSignedUrl={client.contrato_signed_url ?? null}
          contratoDados={
            (client.contrato_dados as Record<string, unknown> | null) ?? null
          }
          urlKey={urlKey ?? undefined}
        />

        {/* Pagamento — admin acompanha o quanto já foi recebido */}
        {(() => {
          const total = Number(client.pagamento_total ?? 0);
          const pago = Number(client.pagamento_pago ?? 0);
          const pendente = Math.max(0, total - pago);
          const pct =
            total > 0 ? Math.min(100, Math.round((pago / total) * 100)) : 0;
          return (
            <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
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
                      <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-fysi-muted">
                        Total
                      </span>
                      <span className="text-fysi-deep font-medium">
                        {formatMoney(total)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-fysi-muted">
                        Pago
                      </span>
                      <span className="text-fysi-deep font-medium">
                        {formatMoney(pago)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-fysi-muted">
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
                  <Button type="submit" size="sm" variant="secondary">
                    Salvar pagamento
                  </Button>
                  {client.pagamento_atualizado_at ? (
                    <span className="text-[0.65rem] text-fysi-muted">
                      Atualizado em {formatDate(client.pagamento_atualizado_at)}
                    </span>
                  ) : null}
                </div>
              </form>
            </section>
          );
        })()}
        </>
        ) : null}

        {tab === "entrega" ? (
        /* Drive — links manuais (Fysi + cliente) */
        <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
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
                🗂️ Pasta da Fysi
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="fysiDriveLink"
                  defaultValue={client.fysi_drive_link ?? ""}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Salvar
                </Button>
              </div>
              <p className="text-[0.65rem] text-fysi-muted">
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

            <form
              action={setDriveLinksAction}
              className="flex flex-col gap-2 border-t border-fysi-line pt-4"
            >
              <input type="hidden" name="clientId" value={client.id} />
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                📂 Drive do cliente (materiais dele)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  name="clienteDriveLink"
                  defaultValue={client.cliente_drive_link ?? ""}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Salvar
                </Button>
              </div>
              <p className="text-[0.65rem] text-fysi-muted">
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

        {tab === "briefing" ? (
        <>
        {/* Resumo de preenchimento do briefing */}
        <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
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
                  <li
                    key={bloco.id}
                    className={`rounded-[12px] border px-3 py-2 ${
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
          <section className="bg-white border border-fysi-line rounded-[20px] p-8 text-center">
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
                  className="bg-white border border-fysi-line rounded-[20px] p-6"
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

                  {fields.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-4">
                      {fields.map((f) => (
                        <div
                          key={f.field_id}
                          className="border-b border-fysi-line last:border-b-0 pb-4 last:pb-0"
                        >
                          <p className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium mb-1">
                            {fieldLabel(f.field_id)}
                          </p>
                          {renderFieldValue(f.field_id, f.value)}
                        </div>
                      ))}
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
        </>
        ) : null}
      </ContentFrame>
    </Shell>
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

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
