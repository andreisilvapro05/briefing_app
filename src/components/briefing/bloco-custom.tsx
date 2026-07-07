"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";
import { loadCliente } from "@/lib/storage";

/**
 * Bloco de perguntas específicas do cliente. Busca as perguntas cadastradas
 * pelo admin (por clientId) e renderiza uma resposta (textarea) por pergunta,
 * salvando com autosave em briefing_responses (field_id
 * = "perguntas-especificas.<id-da-pergunta>").
 */

export const CUSTOM_BLOCO_ID = "perguntas-especificas";

interface Q {
  id: string;
  label: string;
  hint: string | null;
}

function CustomField({ q }: { q: Q }) {
  const [value, setValue] = useBriefingField(CUSTOM_BLOCO_ID, q.id, "");
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
