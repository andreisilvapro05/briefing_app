"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/**
 * Bloco de notas de "Mapeamento de problemas" por cliente. Carrega e salva via
 * /api/admin/client-notes (tolerante à migration não aplicada).
 */
export function ProblemasEditor({
  clientId,
  urlKey,
}: {
  clientId: string;
  urlKey?: string;
}) {
  const keyQ = urlKey ? `&key=${encodeURIComponent(urlKey)}` : "";
  const [notas, setNotas] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(
      `/api/admin/client-notes?clientId=${encodeURIComponent(clientId)}${keyQ}`
    )
      .then((r) => (r.ok ? r.json() : { notas: "" }))
      .then((d) => setNotas(d.notas ?? ""))
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch(`/api/admin/client-notes?${keyQ.slice(1)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, notas }),
      });
      if (r.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label="Notas de problemas / bloqueios"
        hint="Só a equipe vê. Anote pendências, riscos e bloqueios deste cliente."
        rows={10}
        value={notas}
        disabled={!loaded}
        onChange={(e) => {
          setNotas(e.target.value);
          setSaved(false);
        }}
        placeholder={
          loaded
            ? "Ex: cliente não enviou o logo em alta; contrato aguardando assinatura do sócio…"
            : "Carregando…"
        }
      />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={saving || !loaded}>
          {saving ? "Salvando…" : "Salvar notas"}
        </Button>
        {saved ? (
          <span className="text-xs text-fysi-green font-medium">Salvo ✓</span>
        ) : null}
      </div>
    </div>
  );
}
