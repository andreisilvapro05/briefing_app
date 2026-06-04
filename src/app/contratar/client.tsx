"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
 *   Passo 1 (aqui): Tipo + todos os dados de contrato num form só
 *   Passo 2 (redirect /agendar): Calendly embutido
 *   Passo 3 (redirect /dashboard): boas-vindas no painel
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

export function ContratarWizard() {
  const router = useRouter();
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!draft.projectType) return setError("Selecione o tipo de serviço.");
    if (!draft.nome.trim()) return setError("Informe seu nome.");
    if (!draft.whatsapp.trim()) return setError("Informe seu WhatsApp.");
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
      router.push("/agendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  return (
    <Shell tone="cream" sectionLabel="Onboarding · 1 de 2">
      <ContentFrame size="lg">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Pill tone="yellow">Etapa 1 de 2</Pill>
            <span className="text-xs uppercase tracking-[0.12em] text-fysi-muted font-medium">
              Contratação Fysi
            </span>
          </div>
          <h1 className="fysi-display text-3xl md:text-4xl mb-3">
            Bem-vindo à Fysi Lab.
          </h1>
          <p className="text-fysi-muted text-base leading-relaxed max-w-2xl">
            Confirma o serviço contratado e preenche os dados pra contrato.
            Próximo passo já é agendar a chamada.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-6"
        >
          {/* Tipo de serviço */}
          <Group title="Serviço contratado">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {PROJECT_TYPE_OPTIONS.map((opt) => {
                const selected = draft.projectType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update("projectType", opt.id)}
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

          {/* Contato */}
          <Group title="Contato">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Seu nome*"
                autoComplete="name"
                value={draft.nome}
                onChange={(e) => update("nome", e.target.value)}
                placeholder="Nome completo"
              />
              <Input
                label="WhatsApp*"
                autoComplete="tel"
                inputMode="tel"
                value={draft.whatsapp}
                onChange={(e) => update("whatsapp", e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>
            <Input
              label="E-mail*"
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="seu@email.com"
              hint="Pra mandar o contrato e magic link de acesso."
            />
            <Input
              label="Empresa ou projeto*"
              autoComplete="organization"
              value={draft.empresa}
              onChange={(e) => update("empresa", e.target.value)}
              placeholder="Nome da empresa, marca pessoal ou projeto"
            />
          </Group>

          {/* Endereço */}
          <Group title="Endereço">
            <Input
              label="Endereço completo*"
              value={draft.endereco}
              onChange={(e) => update("endereco", e.target.value)}
              placeholder="Rua, número, bairro, cidade, estado"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CEP*"
                value={draft.cep}
                onChange={(e) => update("cep", e.target.value)}
                placeholder="00000-000"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-fysi-deep">
                  Como nos conheceu?*
                </label>
                <select
                  value={draft.como_conheceu}
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
          </Group>

          {/* Documentos */}
          <Group title="Documentos">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CPF*"
                value={draft.cpf}
                onChange={(e) => update("cpf", e.target.value)}
                placeholder="000.000.000-00"
              />
              <Input
                label="RG"
                optional
                value={draft.rg}
                onChange={(e) => update("rg", e.target.value)}
                placeholder="00.000.000-0"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="CNPJ"
                optional
                value={draft.cnpj}
                onChange={(e) => update("cnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
                hint="Se for emitir NF como pessoa jurídica."
              />
              <Input
                label="Razão social"
                optional
                value={draft.razao_social}
                onChange={(e) => update("razao_social", e.target.value)}
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
            <p className="text-xs text-fysi-muted max-w-xs">
              Ao continuar, você concorda em receber comunicação da Fysi Lab
              sobre o andamento do seu projeto.
            </p>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Salvando…" : "Continuar pra agendar →"}
            </Button>
          </div>
        </form>
      </ContentFrame>
    </Shell>
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
