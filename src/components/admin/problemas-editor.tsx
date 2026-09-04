"use client";

import { useCallback, useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/**
 * Bloco de notas de "Mapeamento de problemas" por cliente. Carrega e salva via
 * /api/admin/client-notes.
 *
 * IMPORTANTE — risco de perda de dados já corrigido aqui: antes, falha no
 * carregamento (rede ou erro do servidor) caía num `.catch(() => {})` e
 * mesmo assim habilitava o textarea VAZIO. Salvar em cima apagava as notas
 * reais do cliente. Agora, se o carregamento falha, o campo fica bloqueado
 * com aviso e botão de tentar de novo — nunca dá pra salvar por cima de um
 * estado que não foi lido.
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
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">(
    "carregando"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setEstado("carregando");
    try {
      const r = await fetch(
        `/api/admin/client-notes?clientId=${encodeURIComponent(clientId)}${keyQ}`
      );
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { notas?: string | null };
      setNotas(d.notas ?? "");
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  }, [clientId, keyQ]);

  useEffect(() => {
    // Carrega ao montar; `carregar` faz setState de propósito (é o load).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const r = await fetch(`/api/admin/client-notes?${keyQ.slice(1)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, notas }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setSaved(true);
    } catch {
      setSaveError("Não consegui salvar. Tente de novo em instantes.");
    } finally {
      setSaving(false);
    }
  }

  if (estado === "erro") {
    return (
      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4 flex flex-col items-start gap-2">
        <p className="text-sm text-amber-900">
          Não consegui carregar as notas deste cliente. O campo fica bloqueado
          de propósito — editar agora poderia apagar o que já estava salvo.
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={carregar}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const pronto = estado === "pronto";

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label="Notas de problemas / bloqueios"
        hint="Só a equipe vê. Anote pendências, riscos e bloqueios deste cliente."
        rows={10}
        value={notas}
        disabled={!pronto}
        onChange={(e) => {
          setNotas(e.target.value);
          setSaved(false);
        }}
        placeholder={
          pronto
            ? "Ex: cliente não enviou o logo em alta; contrato aguardando assinatura do sócio…"
            : "Carregando…"
        }
      />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={saving || !pronto}>
          {saving ? "Salvando…" : "Salvar notas"}
        </Button>
        {saved ? (
          <span className="text-xs text-fysi-green font-medium">Salvo ✓</span>
        ) : null}
        {saveError ? (
          <span className="text-xs text-red-600">{saveError}</span>
        ) : null}
      </div>
    </div>
  );
}
