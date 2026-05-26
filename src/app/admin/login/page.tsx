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
      // Redireciona com a senha como ?key= na URL. Isso garante acesso ao
      // admin mesmo quando o cookie é descartado pelo navegador (Brave,
      // Safari ITP, extensões de privacidade). Os links internos do admin
      // preservam o ?key= em toda a navegação.
      // ⚠️ A senha fica visível na URL — não compartilhe o link.
      window.location.href = `/admin?key=${encodeURIComponent(password)}`;
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
          Use a senha compartilhada do painel. Depois de entrar, a URL na
          barra terá a sua chave — <strong>bookmark essa URL</strong> pra
          acessar direto sem precisar logar de novo.
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
