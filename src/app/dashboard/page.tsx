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
import { loadCliente } from "@/lib/storage";
import { getAllResponses } from "@/lib/briefing-store";
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
    setCliente(c);
    setResponses(getAllResponses());
    setLoaded(true);

    // Busca stage + flags do servidor.
    if (c.id) {
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

          <Pill tone="mint" className="self-start md:self-end">
            {projectInfo.title}
          </Pill>
        </div>

        {/* Card "Próximos passos" — 3 fases clicáveis */}
        <section className="mb-10">
          <Eyebrow className="mb-3 block">Próximos passos</Eyebrow>
          <div className="grid sm:grid-cols-3 gap-3">
            <PhaseCard
              numero="01"
              titulo="Dados pra contrato"
              descricao={
                contratoPreenchido
                  ? "Informações enviadas. Você pode atualizar quando quiser."
                  : "Endereço, CPF e razão social pra emitir contrato."
              }
              done={contratoPreenchido}
              actionLabel={contratoPreenchido ? "Editar dados →" : "Preencher agora →"}
              onClick={() => router.push("/contrato")}
            />
            <PhaseCard
              numero="02"
              titulo="Agendar chamada"
              descricao={
                chamadaAgendada
                  ? "Chamada confirmada. Você recebe os detalhes por e-mail."
                  : "30 min com a Karine pra alinhar moodboard e cronograma."
              }
              done={chamadaAgendada}
              actionLabel={chamadaAgendada ? "Reagendar →" : "Escolher horário →"}
              onClick={() => router.push("/agendar")}
            />
            <PhaseCard
              numero="03"
              titulo="Preencher briefing"
              descricao={
                blocosPreenchidos === blocosTotal && blocosTotal > 0
                  ? "Briefing completo. Aguarde retorno do time Fysi."
                  : `${blocosPreenchidos} de ${blocosTotal} blocos preenchidos.`
              }
              done={blocosPreenchidos === blocosTotal && blocosTotal > 0}
              actionLabel={
                blocosPreenchidos === 0
                  ? "Iniciar briefing →"
                  : blocosPreenchidos === blocosTotal
                    ? "Revisar →"
                    : "Continuar →"
              }
              onClick={() => router.push("/briefing")}
              highlighted={contratoPreenchido && !chamadaAgendada ? false : !contratoPreenchido ? false : true}
            />
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

          {/* Coluna direita — Próximo passo + Briefing status */}
          <aside className="flex flex-col gap-6">
            {/* Bloco de ação principal — CTA */}
            <section className="fysi-aurora-dark rounded-[24px] p-6 md:p-8 text-fysi-cream relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <FysiMark
                  size={18}
                  className="text-fysi-mint-vivid"
                  title="Fysi"
                />
                <span className="text-[0.7rem] uppercase tracking-[0.14em] font-medium text-fysi-mint/70">
                  Próximo passo
                </span>
              </div>

              <h2 className="fysi-display text-2xl md:text-3xl mb-3">
                Iniciar briefing
              </h2>
              <p className="text-fysi-mint/80 text-sm leading-relaxed mb-6 max-w-md">
                {projectInfo.hasCopyStep ? "5" : "5"} blocos curtos. Tempo
                médio de preenchimento: 20 minutos. Pode pausar e retomar
                quando quiser — salvamos automaticamente.
              </p>

              <div className="flex items-center gap-3">
                <Button
                  variant="accent"
                  size="lg"
                  leadingIcon={<FysiMark size={16} />}
                  onClick={() => router.push("/briefing")}
                  type="button"
                >
                  Iniciar briefing
                </Button>
                <span className="text-[0.7rem] uppercase tracking-[0.14em] text-fysi-mint/50">
                  Salvamento automático
                </span>
              </div>
            </section>

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
  actionLabel: string;
  onClick: () => void;
  highlighted?: boolean;
}

function PhaseCard({
  numero,
  titulo,
  descricao,
  done,
  actionLabel,
  onClick,
  highlighted,
}: PhaseCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-left rounded-[20px] border p-5 transition flex flex-col gap-2 " +
        (done
          ? "bg-fysi-mint border-fysi-mint-vivid/40 hover:border-fysi-deep/30"
          : highlighted
            ? "bg-fysi-deep text-fysi-cream border-fysi-deep hover:bg-fysi-deep/95"
            : "bg-white border-fysi-line hover:border-fysi-deep/30")
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            "text-[0.7rem] uppercase tracking-[0.14em] font-medium " +
            (done
              ? "text-fysi-deep/70"
              : highlighted
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
        ) : null}
      </div>
      <h3
        className={
          "text-base font-medium tracking-tight " +
          (highlighted && !done ? "text-fysi-cream" : "text-fysi-deep")
        }
      >
        {titulo}
      </h3>
      <p
        className={
          "text-xs leading-relaxed " +
          (done
            ? "text-fysi-deep/70"
            : highlighted
              ? "text-fysi-mint/80"
              : "text-fysi-muted")
        }
      >
        {descricao}
      </p>
      <span
        className={
          "mt-2 text-xs font-medium " +
          (done
            ? "text-fysi-deep"
            : highlighted
              ? "text-fysi-yellow"
              : "text-fysi-deep")
        }
      >
        {actionLabel}
      </span>
    </button>
  );
}
