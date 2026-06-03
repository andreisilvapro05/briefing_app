"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { ProjectTimeline } from "@/components/timeline/project-timeline";
import { FysiMark } from "@/components/brand/fysi-mark";
import { MeusMateriaisCard } from "@/components/meus-materiais-card";
import { EntregaViewer } from "@/components/entrega-viewer";
import type { EntregaDocumento } from "@/lib/entrega";
import {
  buildTimeline,
  PROJECT_TYPE_OPTIONS,
} from "@/lib/project-types";
import { blocosForProject } from "@/lib/briefing-schema";
import { loadCliente, clearCliente, setProjectType } from "@/lib/storage";
import {
  getAllResponses,
  clearAllResponses,
  pullResponsesFromServer,
} from "@/lib/briefing-store";
import type { Cliente, ProjectType } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [serverStageIndex, setServerStageIndex] = useState<number>(0);
  const [contratoPreenchido, setContratoPreenchido] = useState(false);
  const [chamadaAgendada, setChamadaAgendada] = useState(false);
  const [fysiDriveLink, setFysiDriveLink] = useState<string | null>(null);
  const [copyReviewLink, setCopyReviewLink] = useState<string | null>(null);
  const [briefingSubmetido, setBriefingSubmetido] = useState(false);
  const [contratoStatus, setContratoStatus] = useState<string | null>(null);
  const [contratoSignedUrl, setContratoSignedUrl] = useState<string | null>(
    null
  );
  const [pagamentoTotal, setPagamentoTotal] = useState<number | null>(null);
  const [pagamentoPago, setPagamentoPago] = useState<number>(0);
  const [pagamentoObservacao, setPagamentoObservacao] = useState<
    string | null
  >(null);
  const [entregaDoc, setEntregaDoc] = useState<EntregaDocumento | null>(null);
  const [entregaFinalizadaAt, setEntregaFinalizadaAt] = useState<string | null>(
    null
  );

  useEffect(() => {
    const c = loadCliente();
    if (!c) {
      router.replace("/");
      return;
    }

    // Finaliza o load assim que sabemos qual é o projectType válido
    // (do localStorage OU do servidor).
    function finalize(cliente: Cliente, projectType: ProjectType) {
      const tipoConhecido = PROJECT_TYPE_OPTIONS.some(
        (p) => p.id === projectType
      );
      if (!tipoConhecido) {
        router.replace("/projeto");
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCliente({ ...cliente, projectType });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResponses(getAllResponses());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true);
    }

    // Sem id (cliente legacy só-localStorage) — só dá pra confiar em local.
    if (!c.id) {
      if (!c.projectType) {
        router.replace("/projeto");
        return;
      }
      finalize(c, c.projectType);
      return;
    }

    // Cliente tem id mas o projectType não foi definido nem local nem server.
    // Vamos buscar do server abaixo; se servidor também não tiver, renderizamos
    // estado "aguardando equipe definir tipo" em vez de jogar pro /projeto.

    // Com id — sempre busca do servidor pra pegar projectType/stage atuais
    // (o admin pode ter definido/mudado o tipo, ou avançado a fase).
    fetch("/api/me/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: c.id }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const serverPT = data?.projectType as ProjectType | undefined;
        const effectivePT = serverPT ?? c.projectType;

        if (!effectivePT) {
          // Sem tipo definido nem local nem server — ainda assim renderiza
          // o painel com contrato/chamada (que independem do tipo). Só a
          // timeline + briefing ficam escondidos até o admin definir o tipo.
          setCliente(c);
          setResponses(getAllResponses());
          setLoaded(true);
          if (data?.contratoPreenchido) setContratoPreenchido(true);
          if (data?.chamadaAgendada) setChamadaAgendada(true);
          if (data?.briefingSubmetido) setBriefingSubmetido(true);
          if (data?.fysiDriveLink) setFysiDriveLink(data.fysiDriveLink);
          if (data?.copyReviewLink) setCopyReviewLink(data.copyReviewLink);
          if (data?.contratoStatus) setContratoStatus(data.contratoStatus);
          if (data?.contratoSignedUrl)
            setContratoSignedUrl(data.contratoSignedUrl);
          if (typeof data?.pagamentoTotal === "number")
            setPagamentoTotal(data.pagamentoTotal);
          if (typeof data?.pagamentoPago === "number")
            setPagamentoPago(data.pagamentoPago);
          if (data?.pagamentoObservacao)
            setPagamentoObservacao(data.pagamentoObservacao);
          if (data?.entregaDocumento)
            setEntregaDoc(data.entregaDocumento as EntregaDocumento);
          if (data?.entregaFinalizadaAt)
            setEntregaFinalizadaAt(data.entregaFinalizadaAt);
          return;
        }

        // Servidor passa a ser a fonte da verdade do tipo — admin pode mudar.
        if (serverPT && serverPT !== c.projectType) {
          setProjectType(serverPT);
        }

        finalize(c, effectivePT);

        if (typeof data?.stageIndex === "number") {
          setServerStageIndex(data.stageIndex);
        }
        if (data?.contratoPreenchido) setContratoPreenchido(true);
        if (data?.chamadaAgendada) setChamadaAgendada(true);
        if (data?.fysiDriveLink) setFysiDriveLink(data.fysiDriveLink);
        if (data?.copyReviewLink) setCopyReviewLink(data.copyReviewLink);
        if (data?.briefingSubmetido) setBriefingSubmetido(true);
        if (data?.contratoStatus) setContratoStatus(data.contratoStatus);
        if (data?.contratoSignedUrl)
          setContratoSignedUrl(data.contratoSignedUrl);
        if (typeof data?.pagamentoTotal === "number")
          setPagamentoTotal(data.pagamentoTotal);
        if (typeof data?.pagamentoPago === "number")
          setPagamentoPago(data.pagamentoPago);
        if (data?.pagamentoObservacao)
          setPagamentoObservacao(data.pagamentoObservacao);

        // Puxa respostas salvas no servidor — continua de onde parou em
        // qualquer aparelho (ou um sócio convidado vê o que já foi preenchido).
        void pullResponsesFromServer(c.id).then(() =>
          setResponses(getAllResponses())
        );
      })
      .catch(() => {
        // Servidor offline — fallback no localStorage.
        if (!c.projectType) {
          router.replace("/projeto");
          return;
        }
        finalize(c, c.projectType);
      });
  }, [router]);

  const projectInfo = useMemo(
    () =>
      cliente?.projectType
        ? PROJECT_TYPE_OPTIONS.find((p) => p.id === cliente.projectType)
        : undefined,
    [cliente]
  );

  const etapas = useMemo(
    () =>
      cliente?.projectType
        ? buildTimeline(cliente.projectType, serverStageIndex)
        : [],
    [cliente, serverStageIndex]
  );

  function handleSair() {
    // Limpa a sessão local. Essencial em computador compartilhado pra não
    // vazar o briefing pra próxima pessoa. O cliente reentra em /entrar.
    clearCliente();
    clearAllResponses();
    router.replace("/");
  }

  if (!loaded || !cliente) {
    return (
      <Shell tone="cream" hideHeader>
        <ContentFrame size="md">
          <p className="text-fysi-muted text-sm">Carregando…</p>
        </ContentFrame>
      </Shell>
    );
  }

  // Cliente sem tipo de projeto definido pela equipe Fysi ainda.
  // Renderiza o painel parcial: cards de contrato/chamada (que independem do
  // tipo) + aviso amigável no lugar da timeline e do briefing.
  if (!projectInfo) {
    return (
      <Shell tone="cream" sectionLabel="03 · Painel do projeto">
        <ContentFrame size="xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div className="flex flex-col gap-2">
              <Eyebrow>Painel{cliente.empresa ? ` · ${cliente.empresa}` : ""}</Eyebrow>
              <h1 className="fysi-display text-3xl md:text-4xl">
                Olá, {cliente.nome.split(" ")[0]}.
              </h1>
              <p className="text-fysi-muted text-base leading-relaxed max-w-xl">
                Enquanto a equipe Fysi configura seu projeto, você já pode
                adiantar contrato e chamada abaixo.
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              {fysiDriveLink ? (
                <a
                  href={fysiDriveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
                >
                  🗂️ Abrir pasta no Drive →
                </a>
              ) : null}
              <button
                type="button"
                onClick={handleSair}
                className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
              >
                Sair deste briefing
              </button>
            </div>
          </div>

          {/* 📦 Documento de entrega — quando projeto finalizado, isso vira o topo */}
          {entregaFinalizadaAt && entregaDoc ? (
            <div className="mb-8">
              <EntregaViewer
                entrega={entregaDoc}
                finalizadaAt={entregaFinalizadaAt}
              />
            </div>
          ) : null}

          {/* ⚡ Atenção no topo — contrato pendente + pagamento */}
          {contratoStatus === "pendente" ? (
            <section className="bg-fysi-yellow/30 border-2 border-fysi-yellow rounded-[24px] p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">⚡</span>
                <Eyebrow>Atenção · contrato e pagamento</Eyebrow>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-[16px] p-5">
                  <h3 className="font-medium text-fysi-deep mb-2">
                    📝 Contrato pra assinar
                  </h3>
                  <p className="text-sm text-fysi-deep/80 leading-relaxed">
                    Você recebeu um e-mail do <strong>Autentique</strong> com o
                    contrato. Confere sua caixa de entrada (e spam). Após
                    assinatura pelas duas partes, o PDF assinado fica
                    disponível pra download aqui.
                  </p>
                </div>
                <div className="bg-white rounded-[16px] p-5">
                  <h3 className="font-medium text-fysi-deep mb-2">
                    💳 Pagamento via Pix
                  </h3>
                  <p className="text-xs text-fysi-muted mb-2">
                    CNPJ da Fysi pra pagamento:
                  </p>
                  <CopyableValue value="53.470.438/0001-08" label="CNPJ" />
                  <p className="text-xs text-fysi-muted mt-3">
                    Após pagamento, envie o comprovante por e-mail ou WhatsApp.
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* Próximos passos — só contrato + chamada por enquanto */}
          <section className="mb-10">
            <Eyebrow className="mb-4 block">Próximos passos</Eyebrow>
            <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-2">
              <div className="flex-1">
                <PhaseCard
                  numero="01"
                  titulo="Dados pra contrato"
                  descricao={
                    contratoPreenchido
                      ? "Informações enviadas. Você pode atualizar quando quiser."
                      : "Endereço, CPF e razão social pra emitir contrato."
                  }
                  done={contratoPreenchido}
                  active={!contratoPreenchido}
                  important={!contratoPreenchido}
                  actionLabel={contratoPreenchido ? "Editar dados →" : "Preencher agora →"}
                  onClick={() => router.push("/contrato")}
                />
              </div>
              <PhaseArrow />
              <div className="flex-1">
                <PhaseCard
                  numero="02"
                  titulo="Agendar chamada"
                  descricao={
                    chamadaAgendada
                      ? "Chamada confirmada. Você recebe os detalhes por e-mail."
                      : "30 min com a Karine pra alinhar moodboard e cronograma."
                  }
                  done={chamadaAgendada}
                  active={contratoPreenchido && !chamadaAgendada}
                  actionLabel={chamadaAgendada ? "Reagendar →" : "Escolher horário →"}
                  onClick={() => router.push("/agendar")}
                />
              </div>
            </div>
          </section>

          {/* Aviso amigável no lugar da timeline/briefing */}
          <section className="bg-white border border-fysi-line rounded-[24px] p-8 text-center mb-8">
            <Eyebrow className="mb-3 block">Briefing e timeline</Eyebrow>
            <p className="text-fysi-deep leading-relaxed max-w-lg mx-auto">
              A equipe Fysi ainda está definindo o tipo do seu projeto. Assim
              que isso for feito, o briefing e a timeline completa aparecem
              aqui.
            </p>
          </section>

          {/* Meus materiais — mesmo sem project_type, cliente pode enviar */}
          {cliente.id ? (
            <div className="mb-8">
              <MeusMateriaisCard
                clientId={cliente.id}
                onAddMore={() => router.push("/briefing/materiais")}
              />
            </div>
          ) : null}

          {/* Pagamento — sempre que existe valor cadastrado */}
          <div className="mb-8">
            <PaymentCard
              total={pagamentoTotal}
              pago={pagamentoPago}
              observacao={pagamentoObservacao}
            />
          </div>

          {/* Contrato assinado (se já assinado) */}
          {contratoStatus === "assinado" && contratoSignedUrl ? (
            <section className="bg-fysi-mint rounded-[24px] p-6 mb-8">
              <Eyebrow className="mb-2 block">Contrato assinado ✓</Eyebrow>
              <p className="text-sm text-fysi-deep/80 leading-relaxed mb-3">
                Contrato assinado pelas partes. Você pode baixar o PDF a
                qualquer momento.
              </p>
              <a
                href={contratoSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
              >
                Baixar PDF assinado →
              </a>
            </section>
          ) : null}

          {/* Suporte */}
          <section className="bg-fysi-mint rounded-[24px] p-6">
            <Eyebrow className="mb-2 block">Precisa de ajuda?</Eyebrow>
            <p className="text-sm text-fysi-deep/80 leading-relaxed">
              Em qualquer momento você pode falar diretamente com o time Fysi
              pelo WhatsApp do contrato. Estamos aqui para destravar.
            </p>
          </section>
        </ContentFrame>
      </Shell>
    );
  }

  const primeiroNome = cliente.nome.split(" ")[0];

  // Computa progresso real a partir das respostas em localStorage.
  const blocosDoProjeto = blocosForProject(cliente.projectType!);
  const blocosTotal = blocosDoProjeto.length;
  const blocosPreenchidos = blocosDoProjeto.filter((bloco) => {
    const prefix = `${bloco.id}.`;
    return Object.keys(responses).some((k) => {
      if (!k.startsWith(prefix)) return false;
      const v = responses[k];
      if (v === null || v === undefined) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return Object.keys(v).length > 0;
      return Boolean(v);
    });
  }).length;

  return (
    <Shell tone="cream" sectionLabel="03 · Painel do projeto">
      <ContentFrame size="xl">
        {/* Header de boas-vindas */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="flex flex-col gap-2">
            <Eyebrow>Painel · {cliente.empresa}</Eyebrow>
            <h1 className="fysi-display text-3xl md:text-4xl">
              Olá, {primeiroNome}.
            </h1>
            <p className="text-fysi-muted text-base leading-relaxed max-w-xl">
              Você está na primeira etapa do projeto. Abaixo está a timeline
              completa e o status do briefing.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            <Pill tone="mint">{projectInfo.title}</Pill>
            {fysiDriveLink ? (
              <a
                href={fysiDriveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
              >
                🗂️ Abrir pasta no Drive →
              </a>
            ) : null}
            <button
              type="button"
              onClick={handleSair}
              className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              Sair deste briefing
            </button>
          </div>
        </div>

        {/* 📦 Entrega finalizada — vira o destaque número 1 do painel */}
        {entregaFinalizadaAt && entregaDoc ? (
          <div className="mb-8">
            <EntregaViewer
              entrega={entregaDoc}
              finalizadaAt={entregaFinalizadaAt}
            />
          </div>
        ) : null}

        {/* ⚡ Ponto de atenção no topo — contrato pendente + dados de pagamento */}
        {contratoStatus === "pendente" ? (
          <section className="bg-fysi-yellow/30 border-2 border-fysi-yellow rounded-[24px] p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">⚡</span>
              <Eyebrow>Atenção · contrato e pagamento</Eyebrow>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-[16px] p-5">
                <h3 className="font-medium text-fysi-deep mb-2">
                  📝 Contrato pra assinar
                </h3>
                <p className="text-sm text-fysi-deep/80 leading-relaxed">
                  Você recebeu um e-mail do <strong>Autentique</strong> com o
                  contrato. Confere sua caixa de entrada (e spam). Após
                  assinatura pelas duas partes, o PDF assinado fica disponível
                  pra download aqui.
                </p>
              </div>
              <div className="bg-white rounded-[16px] p-5">
                <h3 className="font-medium text-fysi-deep mb-2">
                  💳 Pagamento via Pix
                </h3>
                <p className="text-xs text-fysi-muted mb-2">
                  CNPJ da Fysi pra pagamento:
                </p>
                <CopyableValue value="53.470.438/0001-08" label="CNPJ" />
                <p className="text-xs text-fysi-muted mt-3">
                  Após pagamento, envie o comprovante por e-mail ou WhatsApp.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Sequência de próximos passos — 3 fases ordenadas com setas.
            A "ativa" (próxima a fazer) ganha destaque visual.
            A "01 Contrato" ganha selo IMPORTANTE até estar pronta. */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <Eyebrow>Próximos passos · siga nessa ordem</Eyebrow>
            <span className="text-xs text-fysi-muted hidden md:inline">
              {[contratoPreenchido, chamadaAgendada, briefingSubmetido || (blocosPreenchidos === blocosTotal && blocosTotal > 0)].filter(Boolean).length}/3 concluídos
            </span>
          </div>

          {/* Layout responsivo: empilhado no mobile, lado a lado com setas no desktop */}
          <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-2">
            <div className="flex-1">
              <PhaseCard
                numero="01"
                titulo="Dados pra contrato"
                descricao={
                  contratoPreenchido
                    ? "Informações enviadas. Você pode atualizar quando quiser."
                    : "Endereço, CPF e razão social pra emitir contrato."
                }
                done={contratoPreenchido}
                active={!contratoPreenchido}
                important={!contratoPreenchido}
                actionLabel={contratoPreenchido ? "Editar dados →" : "Preencher agora →"}
                onClick={() => router.push("/contrato")}
              />
            </div>

            <PhaseArrow />

            <div className="flex-1">
              <PhaseCard
                numero="02"
                titulo="Agendar chamada"
                descricao={
                  chamadaAgendada
                    ? "Chamada confirmada. Você recebe os detalhes por e-mail."
                    : !contratoPreenchido
                      ? "Disponível depois do contrato. Pode agendar agora se preferir."
                      : "30 min com a Karine pra alinhar moodboard e cronograma."
                }
                done={chamadaAgendada}
                active={contratoPreenchido && !chamadaAgendada}
                actionLabel={chamadaAgendada ? "Reagendar →" : "Escolher horário →"}
                onClick={() => router.push("/agendar")}
              />
            </div>

            <PhaseArrow />

            <div className="flex-1">
              <PhaseCard
                numero="03"
                titulo="Preencher briefing"
                descricao={
                  briefingSubmetido
                    ? "Briefing concluído. A equipe Fysi já está trabalhando."
                    : blocosPreenchidos === blocosTotal && blocosTotal > 0
                      ? "Briefing completo. Aguarde retorno do time Fysi."
                      : !contratoPreenchido || !chamadaAgendada
                        ? `Disponível após contrato + chamada. ${blocosPreenchidos > 0 ? `${blocosPreenchidos}/${blocosTotal} já preenchidos.` : ""}`
                        : `${blocosPreenchidos} de ${blocosTotal} blocos preenchidos.`
                }
                done={briefingSubmetido || (blocosPreenchidos === blocosTotal && blocosTotal > 0)}
                active={!briefingSubmetido && contratoPreenchido && chamadaAgendada && blocosPreenchidos < blocosTotal}
                actionLabel={
                  blocosPreenchidos === 0
                    ? "Iniciar briefing →"
                    : blocosPreenchidos === blocosTotal
                      ? "Revisar →"
                      : "Continuar →"
                }
                onClick={() => router.push("/briefing")}
              />
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8">
          {/* Coluna esquerda — Timeline */}
          <section className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <Eyebrow>Timeline do projeto</Eyebrow>
              <span className="text-xs text-fysi-muted">
                {etapas.length} etapas · {projectInfo.durationLabel}
              </span>
            </div>

            <ProjectTimeline etapas={etapas} copyReviewLink={copyReviewLink} />
          </section>

          {/* Coluna direita — Status do briefing + Suporte */}
          <aside className="flex flex-col gap-6">
            {/* Status do briefing */}
            <section className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8">
              <Eyebrow className="mb-4 block">Status do briefing</Eyebrow>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-medium tracking-tight">
                  {briefingSubmetido ? blocosTotal : blocosPreenchidos}
                </span>
                <span className="text-fysi-muted text-sm">
                  de {blocosTotal} blocos{" "}
                  {briefingSubmetido ? "concluídos" : "preenchidos"}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-fysi-line overflow-hidden mb-6">
                <div
                  className="h-full bg-fysi-deep transition-[width]"
                  style={{
                    width: briefingSubmetido
                      ? "100%"
                      : `${(blocosPreenchidos / blocosTotal) * 100}%`,
                  }}
                />
              </div>

              <ul className="flex flex-col gap-2 text-sm">
                {blocosDoProjeto.map((bloco) => {
                  const prefix = `${bloco.id}.`;
                  const filledLocal = Object.keys(responses).some((k) => {
                    if (!k.startsWith(prefix)) return false;
                    const v = responses[k];
                    if (v === null || v === undefined) return false;
                    if (typeof v === "string") return v.trim().length > 0;
                    if (Array.isArray(v)) return v.length > 0;
                    if (typeof v === "object")
                      return Object.keys(v).length > 0;
                    return Boolean(v);
                  });
                  // Quando admin marca briefing como concluído, todos os blocos
                  // viram "Concluído" no painel do cliente.
                  const filled = briefingSubmetido || filledLocal;
                  return (
                    <li
                      key={bloco.id}
                      className="flex items-center justify-between py-1.5 border-b border-fysi-line last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/briefing/${bloco.id}`)}
                        className="flex items-center gap-3 text-fysi-deep/80 hover:text-fysi-deep text-left flex-1"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            filled
                              ? "bg-fysi-mint-vivid"
                              : "bg-fysi-line-strong"
                          }`}
                        />
                        <span>{bloco.titulo}</span>
                      </button>
                      <span
                        className={`text-[0.7rem] uppercase tracking-[0.12em] font-medium ${
                          filled ? "text-fysi-deep" : "text-fysi-muted"
                        }`}
                      >
                        {briefingSubmetido
                          ? "Concluído"
                          : filled
                            ? "Iniciado"
                            : "Pendente"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Meus materiais — visão rápida do que o cliente já enviou */}
            {cliente.id ? (
              <MeusMateriaisCard
                clientId={cliente.id}
                onAddMore={() => router.push("/briefing/materiais")}
              />
            ) : null}

            {/* Pagamento — total, pago, pendente + CNPJ pra copiar */}
            <PaymentCard
              total={pagamentoTotal}
              pago={pagamentoPago}
              observacao={pagamentoObservacao}
            />

            {/* Contrato assinado — quando assinado e tem PDF, mostra download */}
            {contratoStatus === "assinado" && contratoSignedUrl ? (
              <section className="bg-fysi-mint rounded-[24px] p-6">
                <Eyebrow className="mb-2 block">Contrato assinado ✓</Eyebrow>
                <p className="text-sm text-fysi-deep/80 leading-relaxed mb-3">
                  Contrato assinado pelas partes. Você pode baixar o PDF a
                  qualquer momento.
                </p>
                <a
                  href={contratoSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
                >
                  Baixar PDF assinado →
                </a>
              </section>
            ) : null}

            {/* Drive da Fysi (só aparece se o admin já colou o link) */}
            {fysiDriveLink ? (
              <section className="bg-white border border-fysi-line rounded-[24px] p-6">
                <Eyebrow className="mb-2 block">Sua pasta no Drive</Eyebrow>
                <p className="text-sm text-fysi-muted leading-relaxed mb-3">
                  A Fysi criou uma pasta no Drive pro seu projeto — é onde
                  vamos compartilhar entregas e materiais.
                </p>
                <a
                  href={fysiDriveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
                >
                  Abrir pasta no Drive →
                </a>
              </section>
            ) : null}

            {/* Suporte */}
            <section className="bg-fysi-mint rounded-[24px] p-6">
              <Eyebrow className="mb-2 block">Precisa de ajuda?</Eyebrow>
              <p className="text-sm text-fysi-deep/80 leading-relaxed">
                Em qualquer momento você pode falar diretamente com o time
                Fysi pelo WhatsApp do contrato. Estamos aqui para destravar.
              </p>
            </section>
          </aside>
        </div>
      </ContentFrame>
    </Shell>
  );
}


function CopyableValue({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="font-mono text-sm text-fysi-deep bg-fysi-cream/60 px-3 py-1.5 rounded-[10px] flex-1 break-all">
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
        className="text-xs font-medium rounded-full bg-fysi-deep text-fysi-cream px-3 py-1.5 hover:bg-fysi-deep/90 whitespace-nowrap"
        aria-label={`Copiar ${label}`}
      >
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}

interface PhaseCardProps {
  numero: string;
  titulo: string;
  descricao: string;
  done: boolean;
  active?: boolean;
  important?: boolean;
  actionLabel: string;
  onClick: () => void;
}

function PhaseCard({
  numero,
  titulo,
  descricao,
  done,
  active,
  important,
  actionLabel,
  onClick,
}: PhaseCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full h-full text-left rounded-[20px] border p-5 transition flex flex-col gap-2 " +
        (done
          ? "bg-fysi-mint border-fysi-mint-vivid/40 hover:border-fysi-deep/30"
          : active
            ? "bg-fysi-deep text-fysi-cream border-fysi-deep hover:bg-fysi-deep/95 shadow-[0_20px_60px_-30px_rgba(4,43,48,0.5)]"
            : "bg-white border-fysi-line hover:border-fysi-deep/30")
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            "text-[0.7rem] uppercase tracking-[0.14em] font-medium " +
            (done
              ? "text-fysi-deep/70"
              : active
                ? "text-fysi-mint/70"
                : "text-fysi-muted")
          }
        >
          Etapa {numero}
        </span>

        {done ? (
          <span className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.1em] font-medium text-fysi-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
            Pronto
          </span>
        ) : important ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-fysi-yellow text-fysi-deep px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.1em] font-semibold">
            ⚡ Importante
          </span>
        ) : null}
      </div>

      <h3
        className={
          "text-base font-medium tracking-tight " +
          (active && !done ? "text-fysi-cream" : "text-fysi-deep")
        }
      >
        {titulo}
      </h3>
      <p
        className={
          "text-xs leading-relaxed " +
          (done
            ? "text-fysi-deep/70"
            : active
              ? "text-fysi-mint/80"
              : "text-fysi-muted")
        }
      >
        {descricao}
      </p>
      <span
        className={
          "mt-auto pt-2 text-xs font-medium " +
          (done
            ? "text-fysi-deep"
            : active
              ? "text-fysi-yellow"
              : "text-fysi-deep")
        }
      >
        {actionLabel}
      </span>
    </button>
  );
}

/**
 * Seta entre os cards mostrando a sequência. Aparece como traço fino
 * no desktop, e sumida no mobile (cards empilhados verticalmente).
 */
function PhaseArrow() {
  return (
    <div
      aria-hidden
      className="hidden md:flex items-center justify-center text-fysi-deep/30"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M5 10 H15 M11 6 L15 10 L11 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * Card de acompanhamento do pagamento. Sempre mostra o CNPJ da Fysi pra
 * copiar (cliente pode pagar a qualquer momento). Quando o admin cadastra
 * o valor total + o que já foi recebido, mostra também progresso e
 * pendência.
 */
function PaymentCard({
  total,
  pago,
  observacao,
}: {
  total: number | null;
  pago: number;
  observacao: string | null;
}) {
  const hasTotal = total !== null && total > 0;
  const pendente = hasTotal ? Math.max(0, (total ?? 0) - pago) : null;
  const pct = hasTotal
    ? Math.min(100, Math.round((pago / (total ?? 1)) * 100))
    : 0;
  const quitado = hasTotal && pendente === 0;

  return (
    <section
      className={
        "rounded-[24px] p-6 " +
        (quitado
          ? "bg-fysi-mint"
          : "bg-white border border-fysi-line")
      }
    >
      <div className="flex items-baseline justify-between mb-3">
        <Eyebrow>Pagamento</Eyebrow>
        {hasTotal ? (
          <span className="text-xs text-fysi-muted">
            {quitado ? "Quitado ✓" : `${pct}% pago`}
          </span>
        ) : null}
      </div>

      {hasTotal ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-fysi-muted">
                Total
              </span>
              <span className="text-fysi-deep font-medium text-sm">
                {formatBRL(total ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-fysi-muted">
                Pago
              </span>
              <span className="text-fysi-deep font-medium text-sm">
                {formatBRL(pago)}
              </span>
            </div>
            <div>
              <span className="block text-[0.65rem] uppercase tracking-[0.12em] text-fysi-muted">
                Pendente
              </span>
              <span
                className={
                  "font-medium text-sm " +
                  (quitado ? "text-fysi-deep" : "text-amber-700")
                }
              >
                {formatBRL(pendente ?? 0)}
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-fysi-line/60 overflow-hidden mb-4">
            <div
              className="h-full bg-fysi-deep transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          {observacao ? (
            <p className="text-xs text-fysi-muted leading-relaxed mb-4">
              {observacao}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-fysi-muted leading-relaxed mb-4">
          Você pode efetuar o pagamento via Pix usando o CNPJ abaixo. Assim
          que recebermos, atualizamos o status aqui.
        </p>
      )}

      {!quitado ? (
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium mb-1.5">
            💳 Pix · CNPJ Fysi
          </p>
          <CopyableValue value="53.470.438/0001-08" label="CNPJ" />
          <p className="text-[0.7rem] text-fysi-muted mt-2 leading-relaxed">
            Após pagamento, envie o comprovante por e-mail ou WhatsApp.
          </p>
        </div>
      ) : (
        <p className="text-sm text-fysi-deep/80 leading-relaxed">
          Pagamento integral confirmado pela equipe Fysi. Obrigado!
        </p>
      )}
    </section>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
