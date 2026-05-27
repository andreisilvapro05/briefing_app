"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { loadCliente, hydrateCliente } from "@/lib/storage";
import type { ProjectType } from "@/lib/types";

interface FormState {
  nome: string;
  whatsapp: string;
  email: string;
  empresa: string;
  endereco: string;
  cep: string;
  rg: string;
  cpf: string;
  cnpj: string;
  razao_social: string;
  como_conheceu: string;
}

const COMO_CONHECEU_OPCOES = [
  "Indicação",
  "Instagram",
  "LinkedIn",
  "Google / Pesquisa",
  "YouTube",
  "Evento / Palestra",
  "Outro",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContratoPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<FormState>({
    nome: "",
    whatsapp: "",
    email: "",
    empresa: "",
    endereco: "",
    cep: "",
    rg: "",
    cpf: "",
    cnpj: "",
    razao_social: "",
    como_conheceu: "",
  });

  useEffect(() => {
    // Pré-preenche com dados do localStorage se o cliente já entrou
    // pelo /painel. Mas /contrato também funciona standalone — quem chega
    // direto preenche nome+whatsapp aqui mesmo e cria o cadastro.
    const c = loadCliente();
    if (c) {
      setClientId(c.id);
      setValues((v) => ({
        ...v,
        nome: c.nome ?? v.nome,
        whatsapp: c.whatsapp ?? v.whatsapp,
        email: c.email ?? v.email,
        empresa: c.empresa ?? v.empresa,
      }));
    }
  }, [router]);

  const standalone = clientId === null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Standalone (sem cliente logado) exige nome + WhatsApp pra criar registro
    if (standalone) {
      if (!values.nome.trim()) {
        setError("Informe seu nome.");
        return;
      }
      if (!values.whatsapp.trim()) {
        setError("Informe seu WhatsApp.");
        return;
      }
    }

    // Mínimos obrigatórios pra emitir contrato:
    // email, empresa, endereço, CEP, CPF, como conheceu
    if (!values.email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    if (!EMAIL_REGEX.test(values.email)) {
      setError("E-mail em formato inválido.");
      return;
    }
    if (!values.empresa.trim()) {
      setError("Informe o nome da empresa ou projeto.");
      return;
    }
    if (
      !values.endereco.trim() ||
      !values.cep.trim() ||
      !values.cpf.trim() ||
      !values.como_conheceu
    ) {
      setError(
        "Preencha endereço, CEP, CPF e como nos conheceu (campos com *)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...values };
      if (clientId) payload.clientId = clientId;
      const res = await fetch("/api/cliente/contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Falha ao salvar.");
      }
      const data = (await res.json().catch(() => null)) as {
        client?: {
          id: string;
          nome: string;
          whatsapp: string;
          email?: string | null;
          empresa?: string | null;
          projectType?: ProjectType | null;
        };
      } | null;

      // Standalone — hidrata localStorage pra que o /dashboard reconheça
      // o cliente e mostre o painel completo.
      if (standalone && data?.client) {
        hydrateCliente({
          id: data.client.id,
          nome: data.client.nome,
          whatsapp: data.client.whatsapp,
          email: data.client.email ?? undefined,
          empresa: data.client.empresa ?? undefined,
          projectType: data.client.projectType ?? undefined,
        });
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  return (
    <Shell tone="cream" sectionLabel="Contrato · Dados">
      <ContentFrame size="lg">
        <div className="flex items-center gap-2 mb-3">
          <Pill tone="yellow">⚡ Importante</Pill>
          <span className="text-xs text-fysi-muted uppercase tracking-[0.1em] font-medium">
            Etapa 01 do projeto
          </span>
        </div>

        <div className="flex flex-col gap-3 mb-10">
          <Eyebrow>Etapa do contrato</Eyebrow>
          <h1 className="fysi-display text-3xl md:text-4xl">
            Dados pra contrato
          </h1>
          <p className="text-fysi-muted text-base leading-relaxed max-w-2xl">
            Sem esses dados não conseguimos emitir seu contrato e iniciar a
            produção. Leva 3 minutos. Tudo fica em sigilo no nosso sistema.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-6"
        >
          {/* Bloco 1 — contato */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-fysi-deep uppercase tracking-[0.1em]">
              Contato
            </h2>
            {standalone ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Seu nome*"
                  name="nome"
                  autoComplete="name"
                  value={values.nome}
                  onChange={(e) => update("nome", e.target.value)}
                  placeholder="Nome completo"
                />
                <Input
                  label="WhatsApp*"
                  name="whatsapp"
                  autoComplete="tel"
                  inputMode="tel"
                  value={values.whatsapp}
                  onChange={(e) => update("whatsapp", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            ) : null}
            <Input
              label="E-mail*"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="seu@email.com"
              hint="Usaremos pra enviar o contrato e link de retomada do briefing."
            />
            <Input
              label="Empresa ou projeto*"
              name="empresa"
              autoComplete="organization"
              value={values.empresa}
              onChange={(e) => update("empresa", e.target.value)}
              placeholder="Nome da empresa, marca pessoal ou projeto"
            />
          </div>

          {/* Bloco 2 — endereço */}
          <div className="flex flex-col gap-5 pt-6 border-t border-fysi-line">
            <h2 className="text-sm font-medium text-fysi-deep uppercase tracking-[0.1em]">
              Endereço
            </h2>
            <Input
              label="Endereço completo*"
              name="endereco"
              value={values.endereco}
              onChange={(e) => update("endereco", e.target.value)}
              placeholder="Rua, número, bairro, cidade, estado"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CEP*"
                name="cep"
                value={values.cep}
                onChange={(e) => update("cep", e.target.value)}
                placeholder="00000-000"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-fysi-deep">
                  Como nos conheceu?*
                </label>
                <select
                  value={values.como_conheceu}
                  onChange={(e) => update("como_conheceu", e.target.value)}
                  className="h-12 rounded-[12px] border border-fysi-line bg-white px-4 text-[0.95rem] text-fysi-deep focus:outline-none focus:border-fysi-green/40"
                >
                  <option value="">Selecionar opção…</option>
                  {COMO_CONHECEU_OPCOES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bloco 3 — documentos */}
          <div className="flex flex-col gap-5 pt-6 border-t border-fysi-line">
            <h2 className="text-sm font-medium text-fysi-deep uppercase tracking-[0.1em]">
              Documentos
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CPF*"
                name="cpf"
                value={values.cpf}
                onChange={(e) => update("cpf", e.target.value)}
                placeholder="000.000.000-00"
              />
              <Input
                label="RG"
                name="rg"
                optional
                value={values.rg}
                onChange={(e) => update("rg", e.target.value)}
                placeholder="00.000.000-0"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CNPJ"
                name="cnpj"
                optional
                value={values.cnpj}
                onChange={(e) => update("cnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
                hint="Preencha se for emitir NF como pessoa jurídica."
              />
              <Input
                label="Razão social"
                name="razao_social"
                optional
                value={values.razao_social}
                onChange={(e) => update("razao_social", e.target.value)}
                placeholder="Nome da empresa no CNPJ"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-fysi-line">
            {standalone ? (
              <span className="text-xs text-fysi-muted">
                Ao enviar, criamos seu painel pessoal automaticamente.
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/dashboard")}
              >
                ← Voltar ao painel
              </Button>
            )}
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Salvando…" : "Salvar e continuar"}
            </Button>
          </div>
        </form>
      </ContentFrame>
    </Shell>
  );
}
