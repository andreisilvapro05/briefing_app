"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/pill";
import Link from "next/link";
import {
  saveCliente,
  loadCliente,
  setClientId,
  setProjectType,
} from "@/lib/storage";
import type { ProjectType } from "@/lib/types";
import { env } from "@/lib/env";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";

interface FormState {
  nome: string;
  whatsapp: string;
}

interface FormErrors {
  nome?: string;
  whatsapp?: string;
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.nome.trim()) errors.nome = "Informe seu nome.";
  if (!values.whatsapp.trim()) errors.whatsapp = "Informe um WhatsApp.";
  else if (values.whatsapp.replace(/\D/g, "").length < 10)
    errors.whatsapp = "Número incompleto.";
  return errors;
}

export default function IdentificacaoPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() => {
    const cliente = loadCliente();
    return {
      nome: cliente?.nome ?? "",
      whatsapp: cliente?.whatsapp ?? "",
    };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    // Se cliente já tem tipo de projeto salvo localmente, vai direto pro
    // dashboard — evita repreencher passos que já foram feitos.
    const c = loadCliente();
    if (c?.projectType) {
      router.replace("/dashboard");
      return;
    }
    mountedAt.current = Date.now();
  }, [router]);

  const turnstileEnabled = !!env.turnstileSiteKey;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSubmitting(true);
    saveCliente({ nome: values.nome, whatsapp: values.whatsapp });

    const elapsedMs = mountedAt.current
      ? Date.now() - mountedAt.current
      : undefined;

    // Tela 1 enxuta — só nome + whatsapp. Email/empresa/contrato vêm em /contrato.
    let nextRoute = "/projeto";
    fetch("/api/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: values.nome,
        whatsapp: values.whatsapp,
        hp: honeypot,
        elapsedMs,
        turnstileToken: turnstileToken || undefined,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          clientId?: string;
          isExisting?: boolean;
          projectType?: ProjectType | null;
        };
        if (data.clientId) setClientId(data.clientId);

        // Se cliente já existe E tem tipo de projeto, sincroniza local e
        // pula direto pro dashboard (evita repreencher /projeto).
        if (data.isExisting && data.projectType) {
          setProjectType(data.projectType);
          nextRoute = "/dashboard";
        }
      })
      .catch(() => {
        // Modo demo / offline — segue só com localStorage
      })
      .finally(() => {
        router.push(nextRoute);
      });
  }

  return (
    <Shell tone="aurora" sectionLabel="01 · Identificação">
      <ContentFrame size="md">
        {/* Toggle no topo: cliente (default) ou admin */}
        <div className="flex items-center gap-2 mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fysi-deep text-fysi-cream px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em]">
            <span className="h-1.5 w-1.5 rounded-full bg-fysi-yellow" />
            Sou cliente Fysi
          </span>
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 rounded-full border border-fysi-deep/15 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-fysi-muted hover:text-fysi-deep hover:border-fysi-deep/30 transition"
          >
            Sou da equipe Fysi →
          </Link>
        </div>

        <div className="flex flex-col gap-3 mb-10">
          <Eyebrow>Onboarding · Briefing</Eyebrow>
          <h1 className="fysi-display text-4xl md:text-5xl">
            Bem-vindo à Fysi Lab.
          </h1>
          <p className="text-fysi-muted text-base md:text-lg leading-relaxed max-w-xl">
            Vamos começar com o básico. Os outros dados (e-mail, endereço,
            CPF para o contrato) ficam pra próxima etapa, no painel.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-5"
        >
          <Input
            label="Nome completo"
            name="nome"
            autoComplete="name"
            value={values.nome}
            onChange={(e) => update("nome", e.target.value)}
            error={errors.nome}
            placeholder="Como gostaria de ser chamado"
          />
          <Input
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            value={values.whatsapp}
            onChange={(e) => update("whatsapp", e.target.value)}
            error={errors.whatsapp}
            hint="Vamos usar pra te avisar quando o time iniciar a produção."
            placeholder="(11) 90000-0000"
          />

          {/* Honeypot — invisível pra humanos, bots preenchem. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              top: "-9999px",
              width: 0,
              height: 0,
              overflow: "hidden",
            }}
          >
            <label htmlFor="company_website">Site (deixe vazio)</label>
            <input
              type="text"
              id="company_website"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {turnstileEnabled ? (
            <TurnstileWidget
              siteKey={env.turnstileSiteKey}
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
            />
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-fysi-line">
            <span className="text-xs text-fysi-muted leading-relaxed">
              Ao continuar, você concorda em receber comunicação da Fysi Lab
              sobre o andamento do seu projeto.
            </span>
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="sm:w-auto w-full"
            >
              {submitting ? "Continuando…" : "Continuar"}
            </Button>
          </div>
        </form>
      </ContentFrame>
    </Shell>
  );
}
