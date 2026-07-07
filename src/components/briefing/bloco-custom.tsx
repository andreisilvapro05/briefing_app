"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";
import { loadCliente } from "@/lib/storage";

/**
 * Bloco de perguntas específicas do cliente. Busca as perguntas cadastradas
 * pelo admin (por clientId) e renderiza cada uma conforme o tipo (texto curto,
 * texto longo ou múltipla escolha), salvando com autosave em briefing_responses
 * (field_id = "perguntas-especificas.<id-da-pergunta>").
 */

export const CUSTOM_BLOCO_ID = "perguntas-especificas";

type Tipo = "texto-curto" | "texto-longo" | "escolha";

interface Q {
  id: string;
  label: string;
  hint: string | null;
  tipo: Tipo;
  opcoes: string[];
}

function CustomField({ q }: { q: Q }) {
  const [value, setValue] = useBriefingField(CUSTOM_BLOCO_ID, q.id, "");
  const opcoes = Array.isArray(q.opcoes) ? q.opcoes : [];

  if (q.tipo === "escolha" && opcoes.length > 0) {
    return (
      <RadioGroup
        name={q.id}
        legend={q.label}
        value={value}
        onChange={setValue}
        options={opcoes.map((o) => ({ value: o, label: o }))}
      />
    );
  }

  if (q.tipo === "texto-curto") {
    return (
      <Input
        label={q.label}
        hint={q.hint ?? undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  }

  return (
    <Textarea
      label={q.label}
      hint={q.hint ?? undefined}
      rows={3}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

export function BlocoCustom() {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cliente = loadCliente();
    if (!cliente?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true);
      return;
    }
    fetch(
      `/api/cliente/custom-questions?clientId=${encodeURIComponent(cliente.id)}`
    )
      .then((r) => (r.ok ? r.json() : { questions: [] }))
      .then((d) => setQuestions(d.questions ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <FieldGroup
      title="Perguntas específicas do seu projeto"
      description="A equipe Fysi preparou algumas perguntas sob medida pra este projeto."
    >
      {!loaded ? (
        <p className="text-sm text-fysi-muted">Carregando…</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          Nenhuma pergunta específica por aqui.
        </p>
      ) : (
        questions.map((q) => <CustomField key={q.id} q={q} />)
      )}
    </FieldGroup>
  );
}
