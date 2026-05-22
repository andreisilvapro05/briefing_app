"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { ProjectTimeline } from "@/components/timeline/project-timeline";
import { FysiMark } from "@/components/brand/fysi-mark";
import {
  buildTimeline,
  PROJECT_TYPE_OPTIONS,
} from "@/lib/project-types";
import { blocosForProject } from "@/lib/briefing-schema";
import { loadCliente, clearCliente } from "@/lib/storage";
import {
  getAllResponses,
  clearAllResponses,
  pullResponsesFromServer,
} from "@/lib/briefing-store";
import type { Cliente } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [serverStageIndex, setServerStageIndex] = useState<number>(0);
  const [contratoPreenchido, setContratoPreenchido] = useState(false);
  const [chamadaAgendada, setChamadaAgendada] = useState(false);

  useEffect(() => {
    const c = loadCliente();
    if (!c) {
      router.replace("/");
      return;
    }
    if (!c.projectType) {
      router.replace("/projeto");
      return;
    }
    // Robustez: tipo de projeto inválido/legado — manda re-escolher em vez
    // de travar a tela em "Carregando…".
    const tipoConhecido = PROJECT_TYPE_OPTIONS.some(
      (p) => p.id === c.projectType
    );
    if (!tipoConhecido) {
      router.replace("/projeto");
      return;
    }
    setCliente(c);
    setResponses(getAllResponses());
    setLoaded(true);

    // Busca stage + flags do servidor.
    if (c.id) {
      // Puxa respostas salvas no servidor — continua de onde parou em
      // qualquer aparelho (ou um sócio convidado vê o que já foi preenchido).
      void pullResponsesFromServer(c.id).then(() =>
        setResponses(getAllResponses())
      );

      fetch("/api/me/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: c.id }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.stageIndex === "number") {
            setServerStageIndex(data.stageIndex);
          }
          if (data?.contratoPreenchido) setContratoPreenchido(true);
          if (data?.chamadaAgendada) setChamadaAgendada(true);
        })
        .catch(() => {
          // Sem servidor / sem cliente no banco — mantém defaults
        });
    }
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

  if (!loaded || !cliente || !projectInfo) {
    return (
      <Shell tone="cream" hideHeader>
        <ContentFrame size="md">
          <p className="text-fysi-muted text-sm">Carregando…</p>
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
            <button
              type="button"
              onClick={handleSair}
              className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              Sair deste briefing
            </button>
          </div>
        </div>

        {/* Sequência de próximos passos — 3 fases ordenadas com setas.
            A "ativa" (próxima a fazer) ganha destaque visual.
            A "01 Contrato" ganha selo IMPORTANTE até estar pronta. */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <Eyebrow>Próximos passos · siga nessa ordem</Eyebrow>
            <span className="text-xs text-fysi-muted hidden md:inline">
              {[contratoPreenchido, chamadaAgendada, blocosPreenchidos === blocosTotal && blocosTotal > 0].filter(Boolean).length}/3 concluídos
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
                  blocosPreenchidos === blocosTotal && blocosTotal > 0
                    ? "Briefing completo. Aguarde retorno do time Fysi."
                    : !contratoPreenchido || !chamadaAgendada
                      ? `Disponível após contrato + chamada. ${blocosPreenchidos > 0 ? `${blocosPreenchidos}/${blocosTotal} já preenchidos.` : ""}`
                      : `${blocosPreenchidos} de ${blocosTotal} blocos preenchidos.`
                }
                done={blocosPreenchidos === blocosTotal && blocosTotal > 0}
                active={contratoPreenchido && chamadaAgendada && blocosPreenchidos < blocosTotal}
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

            <ProjectTimeline etapas={etapas} />
          </section>

          {/* Coluna direita — Status do briefing + Suporte */}
          <aside className="flex flex-col gap-6">
            {/* Status do briefing */}
            <section className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8">
              <Eyebrow className="mb-4 block">Status do briefing</Eyebrow>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-medium tracking-tight">
                  {blocosPreenchidos}
                </span>
                <span className="text-fysi-muted text-sm">
                  de {blocosTotal} blocos preenchidos
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-fysi-line overflow-hidden mb-6">
                <div
                  className="h-full bg-fysi-deep transition-[width]"
                  style={{
                    width: `${(blocosPreenchidos / blocosTotal) * 100}%`,
                  }}
                />
              </div>

              <ul className="flex flex-col gap-2 text-sm">
                {blocosDoProjeto.map((bloco) => {
                  const prefix = `${bloco.id}.`;
                  const filled = Object.keys(responses).some((k) => {
                    if (!k.startsWith(prefix)) return false;
                    const v = responses[k];
                    if (v === null || v === undefined) return false;
                    if (typeof v === "string") return v.trim().length > 0;
                    if (Array.isArray(v)) return v.length > 0;
                    if (typeof v === "object")
                      return Object.keys(v).length > 0;
                    return Boolean(v);
                  });
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
                            filled ? "bg-fysi-mint-vivid" : "bg-fysi-line-strong"
                          }`}
                        />
                        <span>{bloco.titulo}</span>
                      </button>
                      <span
                        className={`text-[0.7rem] uppercase tracking-[0.12em] font-medium ${
                          filled ? "text-fysi-deep" : "text-fysi-muted"
                        }`}
                      >
                        {filled ? "Iniciado" : "Pendente"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

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
