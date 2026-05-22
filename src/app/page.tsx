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
  clearCliente,
} from "@/lib/storage";
import { clearAllResponses } from "@/lib/briefing-store";
import type { Cliente, ProjectType } from "@/lib/types";
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
  const [existing, setExisting] = useState<Cliente | null>(null);
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    // Se já existe briefing neste navegador, mostra a escolha (continuar x
    // começar novo) em vez de redirecionar automático e travar o acesso.
    // Feito no efeito (não no init do useState) pra evitar hydration mismatch:
    // o servidor não tem localStorage e renderiza o formulário.
    const c = loadCliente();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c) setExisting(c);
    mountedAt.current = Date.now();
  }, []);

  function handleComecarNovo() {
    // Limpa a sessão local — libera a Tela 1 pra um briefing do zero
    // (cliente novo no mesmo navegador, ou o mesmo cliente em outro projeto).
    clearCliente();
    clearAllResponses();
    setExisting(null);
    setValues({ nome: "", whatsapp: "" });
    setErrors({});
  }

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

        {existing ? (
          <div className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Eyebrow>Bem-vindo de volta</Eyebrow>
              <h1 className="fysi-display text-3xl md:text-4xl">
                Você já tem um briefing.
              </h1>
              <p className="text-fysi-muted leading-relaxed">
                Encontramos um briefing em andamento neste navegador
                {existing.empresa ? (
                  <>
                    {" "}
                    de{" "}
                    <strong className="text-fysi-deep">
                      {existing.empresa}
                    </strong>
                  </>
                ) : null}
                . Quer continuar de onde parou ou começar um novo?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                size="lg"
                onClick={() =>
                  router.push(
                    existing.projectType ? "/dashboard" : "/projeto"
                  )
                }
                className="sm:w-auto w-full"
              >
                Continuar este briefing →
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleComecarNovo}
                className="sm:w-auto w-full"
              >
                Começar um briefing novo
              </Button>
            </div>
            <p className="text-xs text-fysi-muted border-t border-fysi-line pt-4">
              Quer acessar de outro aparelho?{" "}
              <Link
                href="/entrar"
                className="underline hover:text-fysi-deep font-medium"
              >
                Entrar com WhatsApp + código
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
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

        <p className="text-xs text-fysi-muted mt-5 text-center">
          Já começou um briefing antes?{" "}
          <Link
            href="/entrar"
            className="underline hover:text-fysi-deep font-medium"
          >
            Entrar com WhatsApp + código
          </Link>
        </p>
          </>
        )}
      </ContentFrame>
    </Shell>
  );
}
