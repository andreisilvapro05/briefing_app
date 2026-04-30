"use client";

import { useState, type FormEvent } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/pill";

/**
 * Tela para reentrar pelo magic-link quando o cliente perdeu a sessão.
 * Não é a porta de entrada principal (essa é a Tela 1 — Identificação).
 */

export default function EntrarPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "sent" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Não foi possível enviar o link.");
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  return (
    <Shell tone="aurora" sectionLabel="Acesso · Magic link">
      <ContentFrame size="sm">
        <Eyebrow>Reentrar no briefing</Eyebrow>
        <h1 className="fysi-display text-3xl md:text-4xl mt-2 mb-3">
          Vamos te enviar um link.
        </h1>
        <p className="text-fysi-muted leading-relaxed mb-8">
          Use o e-mail que você usou ao iniciar o briefing. O link chega na
          sua caixa de entrada e te leva direto pro painel.
        </p>

        {status === "sent" ? (
          <div className="bg-white border border-fysi-line rounded-[20px] p-6">
            <p className="text-fysi-deep font-medium mb-2">Link enviado.</p>
            <p className="text-fysi-muted text-sm leading-relaxed">
              Confira sua caixa de entrada (e a pasta de spam, por garantia).
              O link expira em 24 horas.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-fysi-line rounded-[20px] p-6 flex flex-col gap-5"
          >
            <Input
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : null}
            <Button
              type="submit"
              disabled={status === "loading"}
              fullWidth
            >
              {status === "loading" ? "Enviando…" : "Enviar link"}
            </Button>
          </form>
        )}
      </ContentFrame>
    </Shell>
  );
}
