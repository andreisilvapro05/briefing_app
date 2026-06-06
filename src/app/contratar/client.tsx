"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { PROJECT_TYPE_OPTIONS } from "@/lib/project-types";
import { hydrateCliente } from "@/lib/storage";
import type { ProjectType } from "@/lib/types";

/**
 * Fluxo /contratar — 3 abas profissionais com progress indicator.
 *
 *   1. Plano         — escolhe tipo de serviço
 *   2. Seus dados    — nome, contato, endereço, documentos
 *   3. Revisão       — confere tudo + confirma
 *
 * Após confirmar → POST contrato → /agendar (Calendly embutido) → /dashboard.
 *
 * UX: tabs no topo com estado (●ativa / ✓ completa / ◯ pendente). Pode
 * navegar livre via click OU sequencial via "Continuar →".
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

type TabId = "plano" | "dados" | "revisao";

const TABS: Array<{ id: TabId; label: string; emoji: string }> = [
  { id: "plano", label: "Plano", emoji: "🎯" },
  { id: "dados", label: "Seus dados", emoji: "📋" },
  { id: "revisao", label: "Revisão", emoji: "✓" },
];

function planoComplete(d: DraftState): boolean {
  return !!d.projectType;
}

function dadosComplete(d: DraftState): boolean {
  return (
    !!d.nome.trim() &&
    !!d.whatsapp.trim() &&
    EMAIL_REGEX.test(d.email) &&
    !!d.empresa.trim() &&
    !!d.endereco.trim() &&
    !!d.cep.trim() &&
    !!d.cpf.trim() &&
    !!d.como_conheceu
  );
}

export function ContratarWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabId | null;
  const tab: TabId =
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "plano";

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

  function goTab(t: TabId) {
    setError(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", t);
    router.push(`/contratar?${params.toString()}`);
  }

  const progress = useMemo(
    () => ({
      plano: planoComplete(draft),
      dados: dadosComplete(draft),
      revisao: false, // só "completo" depois de submeter
    }),
    [draft]
  );

  function continueFromPlano() {
    if (!draft.projectType) return setError("Selecione um plano antes de continuar.");
    goTab("dados");
  }

  function continueFromDados() {
    if (!draft.nome.trim()) return setError("Informe seu nome.");
    if (!draft.whatsapp.trim()) return setError("Informe seu WhatsApp.");
    if (!EMAIL_REGEX.test(draft.email)) return setError("E-mail inválido.");
    if (!draft.empresa.trim()) return setError("Informe a empresa ou projeto.");
    if (
      !draft.endereco.trim() ||
      !draft.cep.trim() ||
      !draft.cpf.trim() ||
      !draft.como_conheceu
    ) {
      return setError("Preencha endereço, CEP, CPF e como conheceu (campos com *).");
    }
    goTab("revisao");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!planoComplete(draft) || !dadosComplete(draft)) {
      setError("Faltam dados. Confere as abas anteriores.");
      return;
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
          projectType:
            (data.client.projectType ?? draft.projectType) ?? undefined,
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
    <Shell tone="cream" sectionLabel="Contratação Fysi">
      <ContentFrame size="lg">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.14em] text-fysi-muted font-medium mb-2">
            Contratação Fysi Lab
          </p>
          <h1 className="fysi-display text-3xl md:text-4xl">
            {tab === "plano"
              ? "Vamos fechar"
              : tab === "dados"
                ? `Seus dados, ${draft.nome.split(/\s+/)[0] || "vamos lá"}`
                : "Confere antes de enviar"}
          </h1>
        </div>

        {/* Tabs */}
        <TabBar
          current={tab}
          progress={progress}
          onTabClick={(t) => goTab(t)}
        />

        {/* Conteúdo da aba */}
        <div className="bg-white border border-fysi-line rounded-[24px] p-5 md:p-8 mb-4">
          {tab === "plano" ? (
            <PanelPlano
              selected={draft.projectType}
              onPick={(id) => update("projectType", id)}
            />
          ) : tab === "dados" ? (
            <PanelDados draft={draft} onChange={update} />
          ) : (
            <PanelRevisao draft={draft} />
          )}
        </div>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 mb-4">
            {error}
          </p>
        ) : null}

        {/* Footer com navegação */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {tab !== "plano" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => goTab(tab === "dados" ? "plano" : "dados")}
              >
                ← Voltar
              </Button>
            ) : (
              <span className="text-xs text-fysi-muted">
                Etapa 1 de 3 · sem pressa
              </span>
            )}
          </div>

          {tab === "plano" ? (
            <Button type="button" size="lg" onClick={continueFromPlano}>
              Continuar →
            </Button>
          ) : tab === "dados" ? (
            <Button type="button" size="lg" onClick={continueFromDados}>
              Revisar →
            </Button>
          ) : (
            <form onSubmit={submit}>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? "Enviando…" : "Confirmar e agendar chamada →"}
              </Button>
            </form>
          )}
        </div>
      </ContentFrame>
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function TabBar({
  current,
  progress,
  onTabClick,
}: {
  current: TabId;
  progress: Record<TabId, boolean>;
  onTabClick: (t: TabId) => void;
}) {
  return (
    <div className="mb-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TABS.map((t, i) => {
          const active = t.id === current;
          const done = progress[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabClick(t.id)}
              className={
                "relative flex items-center gap-2 px-3 py-2.5 rounded-[12px] border-2 transition text-left " +
                (active
                  ? "bg-fysi-deep border-fysi-deep text-fysi-cream"
                  : done
                    ? "bg-fysi-mint border-fysi-mint-vivid/40 text-fysi-deep"
                    : "bg-white border-fysi-line text-fysi-deep/70 hover:border-fysi-deep/30")
              }
            >
              <span
                className={
                  "h-6 w-6 rounded-full inline-flex items-center justify-center text-xs font-semibold shrink-0 " +
                  (active
                    ? "bg-fysi-cream/20 text-fysi-cream"
                    : done
                      ? "bg-fysi-deep text-fysi-cream"
                      : "bg-fysi-cream/60 text-fysi-deep")
                }
              >
                {done && !active ? "✓" : i + 1}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[0.6rem] uppercase tracking-[0.08em] opacity-80">
                  Etapa {i + 1}
                </span>
                <span className="text-sm font-medium truncate">
                  {t.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function PanelPlano({
  selected,
  onPick,
}: {
  selected: ProjectType | null;
  onPick: (id: ProjectType) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-fysi-muted">
        Escolha o plano que você contratou. Confirmamos juntos na chamada.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {PROJECT_TYPE_OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPick(opt.id)}
              className={
                "text-left bg-white border-2 rounded-[16px] p-4 transition flex flex-col gap-2.5 " +
                (isSelected
                  ? "border-fysi-deep shadow-[0_10px_28px_-14px_rgba(4,43,48,0.4)]"
                  : "border-fysi-line hover:border-fysi-deep/40")
              }
            >
              <div className="flex items-center justify-between">
                <Pill tone="mint">{opt.durationLabel}</Pill>
                <span
                  className={
                    "h-4 w-4 rounded-full border-2 transition shrink-0 " +
                    (isSelected
                      ? "border-fysi-deep bg-fysi-deep"
                      : "border-fysi-line")
                  }
                />
              </div>
              <h3 className="text-base font-medium text-fysi-deep leading-tight">
                {opt.title}
              </h3>
              <p className="text-xs text-fysi-muted leading-snug">
                {opt.description}
              </p>
              <p className="text-[0.65rem] text-fysi-muted border-t border-fysi-line pt-2 mt-auto">
                {opt.hasCopyStep
                  ? "✓ Inclui criação da copy"
                  : "📝 Você envia textos prontos"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function PanelDados({
  draft,
  onChange,
}: {
  draft: DraftState;
  onChange: <K extends keyof DraftState>(k: K, v: DraftState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <Section titulo="Contato">
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
            placeholder="(11) 90000-0000"
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
      </Section>

      <Section titulo="Endereço">
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
      </Section>

      <Section titulo="Documentos">
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
      </Section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function PanelRevisao({ draft }: { draft: DraftState }) {
  const planoInfo = draft.projectType
    ? PROJECT_TYPE_OPTIONS.find((p) => p.id === draft.projectType)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-fysi-muted">
        Dá uma conferida nos dados antes de enviar. Se algo estiver errado, é
        só voltar pra editar.
      </p>

      <ReviewCard titulo="🎯 Plano">
        {planoInfo ? (
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-fysi-deep font-medium">{planoInfo.title}</p>
              <p className="text-xs text-fysi-muted leading-relaxed mt-1">
                {planoInfo.description}
              </p>
            </div>
            <Pill tone="mint">{planoInfo.durationLabel}</Pill>
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            ⚠ Plano não selecionado — volta na aba Plano.
          </p>
        )}
      </ReviewCard>

      <ReviewCard titulo="📋 Contato">
        <ReviewRow label="Nome" value={draft.nome} />
        <ReviewRow label="WhatsApp" value={draft.whatsapp} />
        <ReviewRow label="E-mail" value={draft.email} />
        <ReviewRow label="Empresa" value={draft.empresa} />
      </ReviewCard>

      <ReviewCard titulo="🏠 Endereço">
        <ReviewRow label="Endereço" value={draft.endereco} />
        <ReviewRow label="CEP" value={draft.cep} />
        <ReviewRow label="Como conheceu" value={draft.como_conheceu} />
      </ReviewCard>

      <ReviewCard titulo="📄 Documentos">
        <ReviewRow label="CPF" value={draft.cpf} />
        {draft.rg ? <ReviewRow label="RG" value={draft.rg} /> : null}
        {draft.cnpj ? <ReviewRow label="CNPJ" value={draft.cnpj} /> : null}
        {draft.razao_social ? (
          <ReviewRow label="Razão social" value={draft.razao_social} />
        ) : null}
      </ReviewCard>

      <div className="rounded-[14px] bg-fysi-mint border border-fysi-mint-vivid/30 px-4 py-3">
        <p className="text-sm text-fysi-deep leading-relaxed">
          📅 <strong>Próximo passo</strong>: depois de confirmar, você vai pra
          tela de agendar a chamada de alinhamento — 30 minutos com a Karine
          pra fechar moodboard e cronograma.
        </p>
      </div>
    </div>
  );
}

function ReviewCard({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-fysi-line bg-fysi-cream/30 px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold mb-2">
        {titulo}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-fysi-muted text-xs uppercase tracking-[0.06em] w-32 shrink-0">
        {label}
      </span>
      <span className="text-fysi-deep text-right min-w-0 truncate flex-1">
        {value || <em className="text-fysi-muted/60">—</em>}
      </span>
    </div>
  );
}

function Section({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-deep font-semibold border-b border-fysi-line pb-2">
        {titulo}
      </h2>
      {children}
    </div>
  );
}
