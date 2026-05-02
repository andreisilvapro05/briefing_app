"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/pill";
import { saveCliente, loadCliente, setClientId } from "@/lib/storage";
import { env } from "@/lib/env";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";

interface FormState {
  nome: string;
  email: string;
  empresa: string;
  whatsapp: string;
}

interface FormErrors {
  nome?: string;
  email?: string;
  empresa?: string;
  whatsapp?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.nome.trim()) errors.nome = "Informe seu nome.";
  if (!values.email.trim()) errors.email = "Informe seu e-mail.";
  else if (!EMAIL_REGEX.test(values.email))
    errors.email = "E-mail em formato inválido.";
  if (!values.empresa.trim()) {
    errors.empresa = "Informe o nome da empresa ou projeto.";
  } else {
    // Rejeita CPF (11 dígitos) ou CNPJ (14 dígitos) usados como nome.
    const onlyDigits = values.empresa.replace(/\D/g, "");
    const stripped = values.empresa.replace(/[\d.\-/\s]/g, "");
    if (onlyDigits.length === 11 || onlyDigits.length === 14) {
      errors.empresa =
        "Use o nome da empresa ou marca, não CPF/CNPJ.";
    } else if (stripped.length < 2) {
      errors.empresa = "Use um nome legível (mínimo 2 letras).";
    }
  }
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
      email: cliente?.email ?? "",
      empresa: cliente?.empresa ?? "",
      whatsapp: cliente?.whatsapp ?? "",
    };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

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
    saveCliente(values);

    const elapsedMs = mountedAt.current
      ? Date.now() - mountedAt.current
      : undefined;

    fetch("/api/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        hp: honeypot,
        elapsedMs,
        turnstileToken: turnstileToken || undefined,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { clientId?: string };
        if (data.clientId) setClientId(data.clientId);
      })
      .catch(() => {
        // Modo demo / offline — segue só com localStorage
      })
      .finally(() => {
        router.push("/projeto");
      });
  }

  return (
    <Shell tone="aurora" sectionLabel="01 · Identificação">
      <ContentFrame size="md">
        <div className="flex flex-col gap-3 mb-10">
          <Eyebrow>Onboarding · Briefing</Eyebrow>
          <h1 className="fysi-display text-4xl md:text-5xl">
            Bem-vindo à Fysi Lab.
          </h1>
          <p className="text-fysi-muted text-base md:text-lg leading-relaxed max-w-xl">
            Este é o ponto de partida do seu projeto. Antes de qualquer
            decisão de design ou copy, estruturamos as informações que vão
            sustentar tudo o que vem a seguir.
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
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            error={errors.email}
            hint="Usaremos para enviar o link de retomada do briefing."
            placeholder="seu@email.com"
          />
          <Input
            label="Empresa ou projeto"
            name="empresa"
            autoComplete="organization"
            value={values.empresa}
            onChange={(e) => update("empresa", e.target.value)}
            error={errors.empresa}
            placeholder="Nome da empresa, marca pessoal ou projeto"
          />
          <Input
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            value={values.whatsapp}
            onChange={(e) => update("whatsapp", e.target.value)}
            error={errors.whatsapp}
            placeholder="(11) 90000-0000"
          />

          {/* Honeypot — invisível pra humanos, bots costumam preencher.
              aria-hidden + tabIndex=-1 + position absolute fora da tela. */}
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
