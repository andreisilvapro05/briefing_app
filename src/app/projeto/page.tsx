"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { PROJECT_TYPE_OPTIONS } from "@/lib/project-types";
import { loadCliente, setProjectType } from "@/lib/storage";
import type { ProjectType } from "@/lib/types";

export default function EscolhaFluxoPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<ProjectType | null>(null);
  const [nome, setNome] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const cliente = loadCliente();
    if (!cliente) {
      router.replace("/");
      return;
    }
    setNome(cliente.nome.split(" ")[0] ?? "");
    if (cliente.projectType) setSelected(cliente.projectType);
  }, [router]);

  function handleContinue() {
    if (!selected) return;
    setSubmitting(true);
    const updated = setProjectType(selected);
    // Persiste no banco também — senão o tipo fica só no localStorage e o
    // admin vê "vazio" até o envio do briefing. Best-effort: não bloqueia.
    if (updated?.id) {
      void fetch("/api/cliente/project-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: updated.id, projectType: selected }),
      }).catch(() => {
        // best-effort — a navegação segue mesmo se falhar
      });
    }
    setTimeout(() => router.push("/dashboard"), 250);
  }

  return (
    <Shell tone="cream" sectionLabel="02 · Tipo de projeto">
      <ContentFrame size="lg">
        <div className="flex flex-col gap-3 mb-10">
          <Eyebrow>Escolha do fluxo</Eyebrow>
          <h1 className="fysi-display text-3xl md:text-4xl">
            {nome ? `${nome}, ` : ""}o que você contratou com a Fysi?
          </h1>
          <p className="text-fysi-muted text-base leading-relaxed max-w-xl">
            Sua escolha aqui define a timeline e os blocos do briefing.
            Você pode revisar isso depois, se necessário.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PROJECT_TYPE_OPTIONS.map((option) => {
            const isActive = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                aria-pressed={isActive}
                className={cn(
                  "group text-left rounded-[20px] border p-6 flex flex-col gap-3 transition",
                  "focus:outline-none",
                  isActive
                    ? "bg-fysi-deep text-fysi-cream border-fysi-deep shadow-[0_20px_60px_-30px_rgba(4,43,48,0.5)]"
                    : "bg-white border-fysi-line hover:border-fysi-deep/30 hover:-translate-y-0.5"
                )}
              >
                <div className="flex items-center justify-between">
                  <Pill
                    tone={isActive ? "yellow" : "outline"}
                    className={cn(
                      "transition",
                      !isActive && "border-fysi-deep/15"
                    )}
                  >
                    {option.durationLabel}
                  </Pill>
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition",
                      isActive
                        ? "bg-fysi-yellow border-fysi-yellow"
                        : "border-fysi-deep/20 group-hover:border-fysi-deep/40"
                    )}
                  />
                </div>

                <h3
                  className={cn(
                    "text-lg font-medium tracking-tight mt-2",
                    isActive ? "text-fysi-cream" : "text-fysi-deep"
                  )}
                >
                  {option.title}
                </h3>
                <p
                  className={cn(
                    "text-sm leading-relaxed",
                    isActive ? "text-fysi-mint/80" : "text-fysi-muted"
                  )}
                >
                  {option.description}
                </p>

                <div
                  className={cn(
                    "mt-3 pt-3 border-t text-xs leading-relaxed",
                    isActive
                      ? "border-white/10 text-fysi-mint/70"
                      : "border-fysi-line text-fysi-muted"
                  )}
                >
                  {option.hasCopyStep
                    ? "Inclui etapa de criação da copy."
                    : "Você envia os textos prontos."}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 mt-10">
          <Button
            variant="ghost"
            size="md"
            onClick={() => router.push("/")}
            type="button"
          >
            ← Voltar
          </Button>
          <Button
            size="lg"
            disabled={!selected || submitting}
            onClick={handleContinue}
            type="button"
            className="sm:w-auto w-full"
          >
            {submitting ? "Carregando…" : "Continuar"}
          </Button>
        </div>
      </ContentFrame>
    </Shell>
  );
}
