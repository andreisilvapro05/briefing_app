"use client";

import { useState, type FormEvent } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/pill";

export default function AdminLoginPage() {
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
      const res = await fetch("/api/auth/admin-login", {
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
    <Shell tone="deep" sectionLabel="Admin · Acesso">
      <ContentFrame size="sm">
        <Eyebrow className="text-fysi-mint/70">Painel interno</Eyebrow>
        <h1 className="fysi-display text-fysi-cream text-3xl md:text-4xl mt-2 mb-3">
          Acesso da equipe Fysi.
        </h1>
        <p className="text-fysi-mint/80 leading-relaxed mb-8">
          Use seu e-mail Fysi. Enviamos um link de acesso por e-mail —
          válido por 24h.
        </p>

        {status === "sent" ? (
          <div className="bg-white/5 border border-white/10 rounded-[20px] p-6 text-fysi-cream">
            <p className="font-medium mb-2">Link enviado para {email}.</p>
            <p className="text-fysi-mint/70 text-sm">
              Verifique sua caixa de entrada.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-5"
          >
            <Input
              label="E-mail"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@fysilab.com"
            />
            {error ? (
              <p className="text-xs text-red-300">{error}</p>
            ) : null}
            <Button
              type="submit"
              variant="accent"
              disabled={status === "loading"}
              fullWidth
            >
              {status === "loading" ? "Enviando…" : "Enviar link de acesso"}
            </Button>
          </form>
        )}
      </ContentFrame>
    </Shell>
  );
}
