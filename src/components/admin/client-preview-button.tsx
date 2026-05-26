"use client";

import { useState } from "react";
import { hydrateCliente } from "@/lib/storage";

/**
 * Abre o painel do cliente em nova aba pra o admin espiar.
 *
 * Funciona hidratando o localStorage com os dados do cliente (via /api/admin/
 * clients/[id]/snapshot) e abrindo /dashboard em nova aba — o dashboard
 * lê o localStorage como se fosse o próprio cliente logado.
 *
 * Aviso: isso sobrescreve o localStorage do navegador do admin. Se o admin
 * estava em outra "sessão de cliente" (improvável), perde. Pra limpar,
 * basta clicar em "Sair" no dashboard preview.
 */
export function ClientPreviewButton({
  clientId,
  urlKey,
}: {
  clientId: string;
  urlKey?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
      const res = await fetch(
        `/api/admin/clients/${clientId}/snapshot${keyParam}`
      );
      if (!res.ok) {
        setError(`Falha (HTTP ${res.status}). Tenta de novo.`);
        return;
      }
      const data = (await res.json()) as {
        id: string;
        nome: string;
        whatsapp: string;
        email?: string;
        empresa?: string;
        projectType?:
          | "landing-com-copy"
          | "landing-sem-copy"
          | "site-completo";
      };
      hydrateCliente(data);
      window.open("/dashboard", "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center rounded-full border border-fysi-deep/15 text-fysi-deep text-xs font-medium px-3 py-1.5 hover:bg-fysi-cream disabled:opacity-50"
      >
        {pending ? "Carregando…" : "👁 Ver como cliente"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
