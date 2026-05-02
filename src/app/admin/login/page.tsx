"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/pill";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/admin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setStatus("error");
          setError("Senha incorreta.");
          return;
        }
        const text = await res.text();
        throw new Error(text || "Falha no login.");
      }
      // Redirect duro pra refazer o middleware com o cookie novo
      window.location.href = "/admin";
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
          Use a senha compartilhada do painel. Sessão dura 30 dias por
          dispositivo — pode fechar o navegador sem perder o acesso.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-5"
        >
          <Input
            label="Senha do painel"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
            placeholder="••••••••"
          />
          <Button
            type="submit"
            variant="accent"
            disabled={status === "loading" || password.length === 0}
            fullWidth
          >
            {status === "loading" ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="text-fysi-mint/50 text-xs mt-6 leading-relaxed">
          Esqueceu a senha? Pergunte na equipe Fysi — está documentada no
          gerenciador de senhas interno. Para emergência, ela está no painel
          Vercel em <code className="font-mono">ADMIN_PASSWORD</code>.
        </p>
      </ContentFrame>
    </Shell>
  );
}
