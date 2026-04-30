"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { FysiMark } from "@/components/brand/fysi-mark";
import { loadCliente } from "@/lib/storage";
import { getAllResponses } from "@/lib/briefing-store";
import { blocosForProject } from "@/lib/briefing-schema";
import type { Cliente } from "@/lib/types";

export default function RevisaoPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [router]);

  const blocos = useMemo(
    () => (cliente?.projectType ? blocosForProject(cliente.projectType) : []),
    [cliente]
  );

  function fieldsForBloco(blocoId: string) {
    const prefix = `${blocoId}.`;
    return Object.entries(responses)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ key: k.replace(prefix, ""), value: v }));
  }

  async function handleSubmit() {
    if (!cliente) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/briefing/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente,
          responses,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Não foi possível enviar o briefing.");
      }
      router.push("/briefing/concluido");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado ao enviar."
      );
      setSubmitting(false);
    }
  }

  if (!cliente) {
    return (
      <Shell tone="cream" hideHeader>
        <ContentFrame size="md">
          <p className="text-fysi-muted text-sm">Carregando…</p>
        </ContentFrame>
      </Shell>
    );
  }

  return (
    <Shell tone="cream" sectionLabel="Revisão · Envio final">
      <ContentFrame size="lg">
        <header className="flex flex-col gap-3 mb-10">
          <Eyebrow>Revisão final</Eyebrow>
          <h1 className="fysi-display text-3xl md:text-4xl">
            Quase lá. Revise antes de enviar.
          </h1>
          <p className="text-fysi-muted text-base leading-relaxed max-w-2xl">
            Abaixo está um resumo do que você preencheu. Você pode voltar a
            qualquer bloco para ajustar. Quando enviar, o briefing chega
            estruturado para o time Fysi.
          </p>
        </header>

        <div className="flex flex-col gap-6 mb-10">
          {blocos.map((bloco) => {
            const fields = fieldsForBloco(bloco.id);
            return (
              <section
                key={bloco.id}
                className="bg-white border border-fysi-line rounded-[20px] p-6"
              >
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <Eyebrow>
                      Bloco {String(bloco.numero).padStart(2, "0")}
                    </Eyebrow>
                    <h2 className="text-lg font-medium text-fysi-deep mt-1">
                      {bloco.titulo}
                    </h2>
                  </div>
                  <Pill tone={fields.length > 0 ? "mint" : "muted"}>
                    {fields.length > 0
                      ? `${fields.length} campos preenchidos`
                      : "Não preenchido"}
                  </Pill>
                </div>

                {fields.length === 0 ? (
                  <p className="text-sm text-fysi-muted">
                    Nada preenchido neste bloco ainda.
                  </p>
                ) : (
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                    {fields.slice(0, 8).map((f) => (
                      <div key={f.key} className="flex flex-col gap-0.5">
                        <dt className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                          {f.key}
                        </dt>
                        <dd className="text-sm text-fysi-deep truncate">
                          {summarize(f.value)}
                        </dd>
                      </div>
                    ))}
                    {fields.length > 8 ? (
                      <p className="text-xs text-fysi-muted col-span-full">
                        + {fields.length - 8} campos adicionais
                      </p>
                    ) : null}
                  </dl>
                )}

                <div className="mt-4 pt-4 border-t border-fysi-line">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => router.push(`/briefing/${bloco.id}`)}
                  >
                    Editar bloco →
                  </Button>
                </div>
              </section>
            );
          })}
        </div>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-4">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-8 border-t border-fysi-line">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            ← Voltar ao painel
          </Button>
          <Button
            size="lg"
            variant="accent"
            disabled={submitting}
            onClick={handleSubmit}
            leadingIcon={<FysiMark size={16} />}
            type="button"
          >
            {submitting ? "Enviando…" : "Enviar briefing"}
          </Button>
        </div>
      </ContentFrame>
    </Shell>
  );
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return `${value.length} item${value.length > 1 ? "s" : ""}`;
  }
  if (typeof value === "object") return "Objeto";
  return "—";
}
