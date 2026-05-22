"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/pill";
import { hydrateCliente } from "@/lib/storage";
import { pullResponsesFromServer } from "@/lib/briefing-store";
import type { ProjectType } from "@/lib/types";

/**
 * Entrar no briefing de qualquer aparelho — WhatsApp + código de acesso.
 *
 * Permite reentrar depois de trocar de celular/computador e também que outra
 * pessoa (um sócio) acesse o mesmo briefing. Ao entrar, baixa as respostas
 * já salvas pra continuar de onde parou.
 */

export default function EntrarPage() {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, code }),
      });

      if (!res.ok) {
        setStatus("error");
        if (res.status === 401) {
          setError("Código de acesso incorreto.");
        } else if (res.status === 404) {
          setError(
            "Nenhum briefing encontrado com esse número de WhatsApp."
          );
        } else if (res.status === 503) {
          setError("Acesso ainda não configurado. Fale com a equipe Fysi.");
        } else {
          setError("Não foi possível entrar. Tente novamente.");
        }
        return;
      }

      const data = (await res.json()) as {
        id: string;
        nome: string;
        whatsapp: string;
        email?: string;
        empresa?: string;
        projectType?: ProjectType;
      };

      hydrateCliente(data);
      // Continua de onde parou — em qualquer aparelho.
      await pullResponsesFromServer(data.id);
      router.replace(data.projectType ? "/dashboard" : "/projeto");
    } catch {
      setStatus("error");
      setError("Erro de conexão. Tente novamente.");
    }
  }

  return (
    <Shell tone="aurora" sectionLabel="Acesso · Entrar">
      <ContentFrame size="sm">
        <Eyebrow>Entrar no seu briefing</Eyebrow>
        <h1 className="fysi-display text-3xl md:text-4xl mt-2 mb-3">
          Acesse de qualquer aparelho.
        </h1>
        <p className="text-fysi-muted leading-relaxed mb-8">
          Use o WhatsApp que você informou ao começar o briefing e o código de
          acesso que a equipe Fysi te passou. Funciona em qualquer celular ou
          computador.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-fysi-line rounded-[20px] p-6 flex flex-col gap-5"
        >
          <Input
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            required
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(11) 90000-0000"
          />
          <Input
            label="Código de acesso"
            name="code"
            required
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código que a Fysi te passou"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button
            type="submit"
            disabled={status === "loading" || !whatsapp || !code}
            fullWidth
          >
            {status === "loading" ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="text-fysi-muted text-xs mt-6 leading-relaxed">
          Ainda não começou um briefing?{" "}
          <Link href="/" className="underline hover:text-fysi-deep">
            Começar agora
          </Link>
          .
        </p>
      </ContentFrame>
    </Shell>
  );
}
