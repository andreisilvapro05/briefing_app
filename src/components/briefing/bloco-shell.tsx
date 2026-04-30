"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Eyebrow } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import type { SaveStatus } from "@/lib/briefing-store";

interface BlocoShellProps {
  steps: { id: string; label: string }[];
  currentStepId: string;
  numero: number;
  titulo: string;
  descricao: string;
  saveStatus?: SaveStatus;
  prevHref?: string;
  nextHref?: string;
  nextDisabled?: boolean;
  isLast?: boolean;
  children: ReactNode;
}

export function BlocoShell({
  steps,
  currentStepId,
  numero,
  titulo,
  descricao,
  saveStatus = "idle",
  prevHref,
  nextHref,
  nextDisabled,
  isLast,
  children,
}: BlocoShellProps) {
  const router = useRouter();
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);
  const completedIds = steps.slice(0, currentIdx).map((s) => s.id);

  return (
    <Shell tone="cream" sectionLabel={`0${numero} · ${titulo}`}>
      <ContentFrame size="lg">
        <StepIndicator
          steps={steps}
          currentStepId={currentStepId}
          completedIds={completedIds}
          className="mb-10"
        />

        <header className="flex flex-col gap-3 mb-8">
          <div className="flex items-center justify-between">
            <Eyebrow>Bloco {String(numero).padStart(2, "0")}</Eyebrow>
            <SaveStatusPill status={saveStatus} />
          </div>
          <h1 className="fysi-display text-3xl md:text-4xl">{titulo}</h1>
          <p className="text-fysi-muted text-base leading-relaxed max-w-2xl">
            {descricao}
          </p>
        </header>

        <div className="flex flex-col gap-6">{children}</div>

        <nav className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-12 pt-8 border-t border-fysi-line">
          <Button
            variant="ghost"
            size="md"
            onClick={() =>
              prevHref ? router.push(prevHref) : router.push("/dashboard")
            }
            type="button"
          >
            ← {prevHref ? "Bloco anterior" : "Voltar ao painel"}
          </Button>
          <Button
            size="lg"
            onClick={() =>
              nextHref
                ? router.push(nextHref)
                : router.push("/briefing/revisao")
            }
            type="button"
            disabled={nextDisabled}
            variant={isLast ? "accent" : "primary"}
          >
            {isLast ? "Revisar e enviar" : "Próximo bloco →"}
          </Button>
        </nav>
      </ContentFrame>
    </Shell>
  );
}

function SaveStatusPill({ status }: { status: SaveStatus }) {
  const map = {
    idle: { label: "—", tone: "muted" },
    saving: { label: "Salvando…", tone: "muted" },
    saved: { label: "Salvo", tone: "mint" },
    error: { label: "Erro ao salvar", tone: "error" },
  } as const;
  const { label, tone } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.1em]",
        tone === "mint" && "bg-fysi-mint text-fysi-deep",
        tone === "muted" && "text-fysi-muted",
        tone === "error" && "bg-red-50 text-red-700"
      )}
    >
      {tone === "mint" ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-fysi-deep" />
      ) : null}
      {label}
    </span>
  );
}

export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6 md:p-8 flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-fysi-deep tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-fysi-muted leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}
