"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { PROJECT_TYPE_OPTIONS } from "@/lib/project-types";
import { hydrateCliente } from "@/lib/storage";
import type { ProjectType } from "@/lib/types";

/**
 * Fluxo /contratar — link pra clientes que já fecharam.
 *
 *   Step 1: Nome + WhatsApp (leve, abre rápido)
 *   Step 2: Tipo de serviço + dados completos de contrato (tudo junto)
 *   → redirect /agendar (Calendly embedded)
 *   → /dashboard
 */

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
const STORAGE_KEY = "fysi:contratar:draft";

interface DraftState {
  projectType: ProjectType | null;
  nome: string;
  whatsapp: string;
  email: string;
  empresa: string;
  endereco: string;
  cep: string;
  cpf: string;
  rg: string;
  cnpj: string;
  razao_social: string;
  como_conheceu: string;
}

const emptyDraft: DraftState = {
  projectType: null,
  nome: "",
  whatsapp: "",
  email: "",
  empresa: "",
  endereco: "",
  cep: "",
  cpf: "",
  rg: "",
  cnpj: "",
  razao_social: "",
  como_conheceu: "",
};

function loadDraft(): DraftState {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft;
    return { ...emptyDraft, ...JSON.parse(raw) };
  } catch {
    return emptyDraft;
  }
}

function saveDraft(d: DraftState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    // sem espaço / modo privado — ignora
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}

type Step = 1 | 2;

export function ContratarWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = Number(searchParams.get("step") ?? "1");
  const step: Step = stepParam === 2 ? 2 : 1;

  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveDraft(draft);
  }, [draft, loaded]);

  function update<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function goStep(s: Step) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(s));
    router.push(`/contratar?${params.toString()}`);
  }

  function submitStep1(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!draft.nome.trim()) return setError("Informe seu nome.");
    if (!draft.whatsapp.trim()) return setError("Informe seu WhatsApp.");
    goStep(2);
  }

  async function submitStep2(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!draft.projectType) return setError("Selecione o tipo de serviço.");
    if (!draft.email.trim() || !EMAIL_REGEX.test(draft.email)) {
      return setError("E-mail inválido.");
    }
    if (!draft.empresa.trim()) return setError("Informe a empresa ou projeto.");
    if (
      !draft.endereco.trim() ||
      !draft.cep.trim() ||
      !draft.cpf.trim() ||
      !draft.como_conheceu
    ) {
      return setError(
        "Preencha endereço, CEP, CPF e como nos conheceu (campos com *)."
      );
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cliente/contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: draft.nome,
          whatsapp: draft.whatsapp,
          email: draft.email,
          empresa: draft.empresa,
          endereco: draft.endereco,
          cep: draft.cep,
          cpf: draft.cpf,
          como_conheceu: draft.como_conheceu,
          rg: draft.rg || undefined,
          cnpj: draft.cnpj || undefined,
          razao_social: draft.razao_social || undefined,
          project_type: draft.projectType,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Falha ao salvar.");
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

      if (data?.client) {
        hydrateCliente({
          id: data.client.id,
          nome: data.client.nome,
          whatsapp: data.client.whatsapp,
          email: data.client.email ?? undefined,
          empresa: data.client.empresa ?? undefined,
          projectType: data.client.projectType ?? draft.projectType,
        });
      }

      clearDraft();
      // Direto pra /agendar (Calendly) — etapa 3 visualmente.
      router.push("/agendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  if (step === 1) {
    return (
      <StepInicial
        draft={draft}
        onChange={update}
        onSubmit={submitStep1}
        error={error}
      />
    );
  }

  return (
    <StepContrato
      draft={draft}
      onChange={update}
      onSubmit={submitStep2}
      onBack={() => goStep(1)}
      submitting={submitting}
      error={error}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────

function StepInicial({
  draft,
  onChange,
  onSubmit,
  error,
}: {
  draft: DraftState;
  onChange: <K extends keyof DraftState>(k: K, v: DraftState[K]) => void;
  onSubmit: (e: FormEvent) => void;
  error: string | null;
}) {
  return (
    <Shell tone="cream" sectionLabel="Onboarding · 1 de 3">
      <ContentFrame size="md">
        <Header
          step={1}
          total={3}
          eyebrow="Contratação Fysi"
          titulo="Bem-vindo à Fysi Lab."
          subtitulo="Vamos começar com o básico. Os outros dados (e-mail, endereço, CPF) ficam na próxima etapa."
        />

        <form
          onSubmit={onSubmit}
          className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-5"
        >
          <Input
            label="Nome completo"
            autoComplete="name"
            value={draft.nome}
            onChange={(e) => onChange("nome", e.target.value)}
            placeholder="Como gostaria de ser chamado"
          />
          <Input
            label="WhatsApp"
            autoComplete="tel"
            inputMode="tel"
            value={draft.whatsapp}
            onChange={(e) => onChange("whatsapp", e.target.value)}
            placeholder="(11) 90000-0000"
            hint="Vamos usar pra te avisar quando o time iniciar a produção."
          />

          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-fysi-line">
            <p className="text-xs text-fysi-muted max-w-xs">
              Ao continuar, você concorda em receber comunicação da Fysi Lab
              sobre o andamento do seu projeto.
            </p>
            <Button type="submit" size="lg">
              Continuar →
            </Button>
          </div>
        </form>
      </ContentFrame>
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function StepContrato({
  draft,
  onChange,
  onSubmit,
  onBack,
  submitting,
  error,
}: {
  draft: DraftState;
  onChange: <K extends keyof DraftState>(k: K, v: DraftState[K]) => void;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const primeiroNome = draft.nome.split(/\s+/)[0];
  return (
    <Shell tone="cream" sectionLabel="Onboarding · 2 de 3">
      <ContentFrame size="lg">
        <Header
          step={2}
          total={3}
          eyebrow="Serviço + contrato"
          titulo={primeiroNome ? `Vamos fechar, ${primeiroNome}.` : "Vamos fechar."}
          subtitulo="Escolhe o serviço que você contratou e preenche os dados do contrato. Próximo passo já é agendar a chamada."
        />

        <form
          onSubmit={onSubmit}
          className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-6"
        >
          {/* Tipo de serviço — cards no topo */}
          <Group title="Serviço contratado">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {PROJECT_TYPE_OPTIONS.map((opt) => {
                const selected = draft.projectType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange("projectType", opt.id)}
                    className={`text-left bg-white border-2 rounded-[16px] p-3.5 transition flex flex-col gap-2 ${
                      selected
                        ? "border-fysi-deep shadow-[0_8px_24px_-12px_rgba(4,43,48,0.3)]"
                        : "border-fysi-line hover:border-fysi-deep/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Pill tone="mint">{opt.durationLabel}</Pill>
                      <span
                        className={`h-3.5 w-3.5 rounded-full border-2 transition shrink-0 ${
                          selected
                            ? "border-fysi-deep bg-fysi-deep"
                            : "border-fysi-line"
                        }`}
                      />
                    </div>
                    <h3 className="text-base font-medium text-fysi-deep">
                      {opt.title}
                    </h3>
                    <p className="text-xs text-fysi-muted leading-snug">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </Group>

          {/* Dados de contrato */}
          <Group title="Contato">
            <Input
              label="E-mail*"
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="seu@email.com"
              hint="Pra mandar o contrato e magic link de acesso."
            />
            <Input
              label="Empresa ou projeto*"
              autoComplete="organization"
              value={draft.empresa}
              onChange={(e) => onChange("empresa", e.target.value)}
              placeholder="Nome da empresa, marca pessoal ou projeto"
            />
          </Group>

          <Group title="Endereço">
            <Input
              label="Endereço completo*"
              value={draft.endereco}
              onChange={(e) => onChange("endereco", e.target.value)}
              placeholder="Rua, número, bairro, cidade, estado"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CEP*"
                value={draft.cep}
                onChange={(e) => onChange("cep", e.target.value)}
                placeholder="00000-000"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-fysi-deep">
                  Como nos conheceu?*
                </label>
                <select
                  value={draft.como_conheceu}
                  onChange={(e) => onChange("como_conheceu", e.target.value)}
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
          </Group>

          <Group title="Documentos">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CPF*"
                value={draft.cpf}
                onChange={(e) => onChange("cpf", e.target.value)}
                placeholder="000.000.000-00"
              />
              <Input
                label="RG"
                optional
                value={draft.rg}
                onChange={(e) => onChange("rg", e.target.value)}
                placeholder="00.000.000-0"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CNPJ"
                optional
                value={draft.cnpj}
                onChange={(e) => onChange("cnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
                hint="Se for emitir NF como pessoa jurídica."
              />
              <Input
                label="Razão social"
                optional
                value={draft.razao_social}
                onChange={(e) => onChange("razao_social", e.target.value)}
                placeholder="Nome da empresa no CNPJ"
              />
            </div>
          </Group>

          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-fysi-line">
            <Button type="button" variant="ghost" onClick={onBack}>
              ← Voltar
            </Button>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Salvando…" : "Continuar pra agendar →"}
            </Button>
          </div>
        </form>
      </ContentFrame>
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function Header({
  step,
  total,
  eyebrow,
  titulo,
  subtitulo,
}: {
  step: number;
  total: number;
  eyebrow: string;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Pill tone="yellow">
          Etapa {step} de {total}
        </Pill>
        <span className="text-xs uppercase tracking-[0.12em] text-fysi-muted font-medium">
          {eyebrow}
        </span>
      </div>
      <h1 className="fysi-display text-3xl md:text-4xl mb-3">{titulo}</h1>
      <p className="text-fysi-muted text-base leading-relaxed max-w-2xl">
        {subtitulo}
      </p>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-fysi-deep uppercase tracking-[0.1em]">
        {title}
      </h2>
      {children}
    </div>
  );
}
