"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { loadCliente } from "@/lib/storage";

const CALENDLY_URL = "https://calendly.com/karinesackt/briefing";

interface CalendlyEventDetail {
  event?: string;
  payload?: { event?: { uri?: string }; invitee?: { uri?: string } };
}

export default function AgendarPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    const c = loadCliente();
    if (!c) {
      router.replace("/");
      return;
    }
    setClientId(c.id);
  }, [router]);

  // Listener pra eventos do Calendly via postMessage. Quando o cliente
  // confirma o agendamento dentro do widget, marcamos como agendada.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (typeof e.data !== "object" || e.data === null) return;
      const data = e.data as CalendlyEventDetail;
      if (
        data.event === "calendly.event_scheduled" &&
        clientId &&
        !scheduled
      ) {
        markAsScheduled();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, scheduled]);

  async function markAsScheduled() {
    if (!clientId) return;
    setSubmitting(true);
    try {
      await fetch("/api/cliente/chamada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, action: "agendou" }),
      });
      setScheduled(true);
    } catch {
      // best-effort
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (!clientId) return;
    setSubmitting(true);
    try {
      await fetch("/api/cliente/chamada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, action: "pulou" }),
      });
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  }

  return (
    <Shell tone="cream" sectionLabel="Agenda · Chamada">
      <ContentFrame size="lg">
        <div className="flex flex-col gap-3 mb-8">
          <Eyebrow>Agendamento</Eyebrow>
          <h1 className="fysi-display text-3xl md:text-4xl">
            Agende sua chamada de alinhamento
          </h1>
          <p className="text-fysi-muted text-base leading-relaxed max-w-2xl">
            Uma conversa de 30 minutos pra alinhar moodboard, expectativas e
            cronograma do seu projeto. Escolha o horário que melhor te atende
            no calendário abaixo.
          </p>
        </div>

        {scheduled ? (
          <div className="bg-fysi-mint border border-fysi-mint-vivid/40 rounded-[20px] p-6 mb-6 flex items-start gap-4">
            <span className="h-2 w-2 rounded-full bg-fysi-deep mt-2" />
            <div>
              <p className="text-fysi-deep font-medium">
                Chamada agendada com sucesso.
              </p>
              <p className="text-fysi-deep/70 text-sm mt-1">
                Você vai receber um e-mail de confirmação com o link da chamada.
                Pode seguir pro próximo passo.
              </p>
              <div className="mt-4">
                <Button
                  size="md"
                  onClick={() => router.push("/dashboard")}
                  type="button"
                >
                  Voltar ao painel →
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Widget em linha do Calendly */}
        <div className="bg-white border border-fysi-line rounded-[24px] p-2 md:p-4 overflow-hidden">
          <div
            className="calendly-inline-widget"
            data-url={CALENDLY_URL}
            style={{ minWidth: "320px", height: "700px" }}
          />
        </div>
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="lazyOnload"
        />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-8 pt-6 border-t border-fysi-line">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard")}
          >
            ← Voltar ao painel
          </Button>

          <div className="flex items-center gap-3">
            <Pill tone="muted">Chamada é opcional</Pill>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSkip}
              disabled={submitting}
            >
              Pular por enquanto
            </Button>
          </div>
        </div>

        <p className="text-xs text-fysi-muted mt-6 leading-relaxed">
          Quando agendar pelo calendário acima, registramos automaticamente.
          Se preferir agendar por outro canal (WhatsApp, etc.), pode clicar em
          &ldquo;Pular por enquanto&rdquo; — você pode voltar depois ao painel.
        </p>
      </ContentFrame>
    </Shell>
  );
}
