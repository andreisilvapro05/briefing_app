"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { PROJECT_TYPE_OPTIONS } from "@/lib/project-types";
import { hydrateCliente } from "@/lib/storage";
import type { ProjectType } from "@/lib/types";

/**
 * Fluxo /contratar — link que o admin manda pro cliente DEPOIS de fechado
 * o negócio. Diferente do briefing exploratório, esse fluxo é objetivo:
 *
 *   Passo 1: Tipo de projeto (cards visuais)
 *   Passo 2: Dados (nome, whatsapp, email, empresa, CPF, endereço, etc)
 *   Passo 3: Confirmação + CTA pra agendar chamada
 *
 * Ao terminar, hidrata o localStorage e leva pro /dashboard.
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

type Step = 1 | 2 | 3;

export function ContratarWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = Number(searchParams.get("step") ?? "1");
  const step: Step = stepParam === 2 ? 2 : stepParam === 3 ? 3 : 1;

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

  function pickType(id: ProjectType) {
    update("projectType", id);
    goStep(2);
  }

  async function submitData(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!draft.projectType) {
      goStep(1);
      return;
    }
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
      goStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  // Não bloqueia avanço de step 2 → 1 se tipo já foi escolhido
  const projectInfo = draft.projectType
    ? PROJECT_TYPE_OPTIONS.find((p) => p.id === draft.projectType)
    : null;

  if (step === 1) {
    return <StepTipo onPick={pickType} selected={draft.projectType} />;
  }

  if (step === 2) {
    return (
      <StepDados
        draft={draft}
        projectInfo={projectInfo}
        onChange={update}
        onSubmit={submitData}
        onBack={() => goStep(1)}
        submitting={submitting}
        error={error}
      />
    );
  }

  return <StepConclusao />;
}

// ────────────────────────────────────────────────────────────────────────────

function StepTipo({
  onPick,
  selected,
}: {
  onPick: (id: ProjectType) => void;
  selected: ProjectType | null;
}) {
  return (
    <Shell tone="cream" sectionLabel="Contratar · Etapa 1 de 3">
      <ContentFrame size="lg">
        <Header
          step={1}
          eyebrow="Contratação"
          titulo="Qual serviço você contratou?"
          subtitulo="Confirma aqui pra a gente já alinhar o fluxo do projeto certo."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROJECT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPick(opt.id)}
              className={`text-left bg-white border-2 rounded-[20px] p-5 hover:border-fysi-deep transition flex flex-col gap-3 ${
                selected === opt.id
                  ? "border-fysi-deep shadow-md"
                  : "border-fysi-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <Pill tone="mint">{opt.durationLabel}</Pill>
                <span
                  className={`h-4 w-4 rounded-full border-2 transition ${
                    selected === opt.id
                      ? "border-fysi-deep bg-fysi-deep"
                      : "border-fysi-line"
                  }`}
                />
              </div>
              <h2 className="fysi-display text-xl text-fysi-deep">{opt.title}</h2>
              <p className="text-sm text-fysi-muted leading-relaxed flex-1">
                {opt.description}
              </p>
              <p className="text-[0.7rem] text-fysi-muted border-t border-fysi-line pt-3 mt-1">
                {opt.hasCopyStep
                  ? "Inclui etapa de criação da copy."
                  : "Você envia os textos prontos."}
              </p>
            </button>
          ))}
        </div>
      </ContentFrame>
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function StepDados({
  draft,
  projectInfo,
  onChange,
  onSubmit,
  onBack,
  submitting,
  error,
}: {
  draft: DraftState;
  projectInfo: ReturnType<typeof PROJECT_TYPE_OPTIONS.find> | null;
  onChange: <K extends keyof DraftState>(k: K, v: DraftState[K]) => void;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <Shell tone="cream" sectionLabel="Contratar · Etapa 2 de 3">
      <ContentFrame size="lg">
        <Header
          step={2}
          eyebrow="Dados pra contrato"
          titulo="Seus dados pra fechar"
          subtitulo="Tudo isso vai pra o contrato. Leva 3 minutos."
        />

        {projectInfo ? (
          <div className="bg-fysi-mint rounded-[14px] border border-fysi-mint-vivid/30 px-4 py-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.1em] text-fysi-deep/70 font-semibold">
                Serviço contratado
              </p>
              <p className="text-fysi-deep font-medium">{projectInfo.title}</p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-fysi-deep hover:underline font-medium"
            >
              Trocar
            </button>
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-6"
        >
          <Group title="Contato">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Seu nome*"
                autoComplete="name"
                value={draft.nome}
                onChange={(e) => onChange("nome", e.target.value)}
                placeholder="Nome completo"
              />
              <Input
                label="WhatsApp*"
                autoComplete="tel"
                inputMode="tel"
                value={draft.whatsapp}
                onChange={(e) => onChange("whatsapp", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
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
              {submitting ? "Salvando…" : "Salvar e continuar →"}
            </Button>
          </div>
        </form>
      </ContentFrame>
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function StepConclusao() {
  return (
    <Shell tone="cream" sectionLabel="Contratar · Etapa 3 de 3">
      <ContentFrame size="md">
        <div className="text-center py-8">
          <div className="text-5xl mb-4">🎉</div>
          <Eyebrow>Tudo certo</Eyebrow>
          <h1 className="fysi-display text-3xl md:text-4xl mt-3 mb-4">
            Bem-vindo à Fysi Lab!
          </h1>
          <p className="text-fysi-muted text-base leading-relaxed mb-6 max-w-md mx-auto">
            Seus dados estão salvos. Próximo passo é agendar nossa chamada de
            alinhamento — 30 minutos pra confirmar moodboard e cronograma.
          </p>

          <div className="flex flex-col gap-2 max-w-sm mx-auto">
            <a
              href="/agendar"
              className="inline-flex items-center justify-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-6 py-3 hover:bg-fysi-deep/90"
            >
              📅 Agendar chamada →
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-fysi-line text-sm font-medium text-fysi-deep px-6 py-3 hover:border-fysi-deep/40"
            >
              Pular e ir pro painel
            </a>
          </div>

          <p className="text-xs text-fysi-muted mt-8">
            Você também recebe o link de acesso ao painel por e-mail.
          </p>
        </div>
      </ContentFrame>
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function Header({
  step,
  eyebrow,
  titulo,
  subtitulo,
}: {
  step: 1 | 2 | 3;
  eyebrow: string;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Pill tone="yellow">Etapa {step} de 3</Pill>
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
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-medium text-fysi-deep uppercase tracking-[0.1em]">
        {title}
      </h2>
      {children}
    </div>
  );
}
