"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/pill";
import { saveCliente, loadCliente } from "@/lib/storage";

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
  if (!values.empresa.trim())
    errors.empresa = "Informe o nome da empresa ou projeto.";
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

    // Best-effort: cria cliente no Supabase e dispara magic link.
    // Falha silenciosa em modo demo (sem env vars).
    void fetch("/api/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => {
      // ignora — fluxo continua via localStorage
    });

    setTimeout(() => router.push("/projeto"), 300);
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
