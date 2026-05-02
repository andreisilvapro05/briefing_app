"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow } from "@/components/ui/pill";
import { loadCliente } from "@/lib/storage";

interface FormState {
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

export default function ContratoPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<FormState>({
    endereco: "",
    cep: "",
    rg: "",
    cpf: "",
    cnpj: "",
    razao_social: "",
    como_conheceu: "",
  });

  useEffect(() => {
    const c = loadCliente();
    if (!c) {
      router.replace("/");
      return;
    }
    setClientId(c.id);
  }, [router]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    setError(null);

    // Mínimos obrigatórios: endereço, CEP, CPF, como conheceu
    if (!values.endereco.trim() || !values.cep.trim() || !values.cpf.trim() || !values.como_conheceu) {
      setError("Preencha endereço, CEP, CPF e como nos conheceu.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cliente/contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...values }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Falha ao salvar.");
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
        <div className="flex flex-col gap-3 mb-10">
          <Eyebrow>Etapa do contrato</Eyebrow>
          <h1 className="fysi-display text-3xl md:text-4xl">
            Dados pra contrato
          </h1>
          <p className="text-fysi-muted text-base leading-relaxed max-w-2xl">
            Estes dados são usados para gerar seu contrato e nota fiscal.
            Tudo fica em sigilo no nosso sistema. Pode pular agora se quiser
            preencher depois — basta voltar ao painel.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-8 flex flex-col gap-5"
        >
          <Input
            label="Endereço completo"
            name="endereco"
            value={values.endereco}
            onChange={(e) => update("endereco", e.target.value)}
            placeholder="Rua, número, bairro, cidade, estado"
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="CEP"
              name="cep"
              value={values.cep}
              onChange={(e) => update("cep", e.target.value)}
              placeholder="00000-000"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-fysi-deep">
                Como nos conheceu?
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

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="CPF"
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

          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-fysi-line">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/dashboard")}
            >
              ← Voltar ao painel
            </Button>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Salvando…" : "Salvar e continuar"}
            </Button>
          </div>
        </form>
      </ContentFrame>
    </Shell>
  );
}
