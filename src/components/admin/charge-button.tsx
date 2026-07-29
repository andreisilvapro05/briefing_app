"use client";

import { useState } from "react";
import { buildChargeMessage, waLink } from "@/lib/cobranca-message";

/**
 * Botão de cobrança: abre o WhatsApp do cliente com a mensagem de pagamento
 * (Pix + cartão) já pronta, e permite copiar a mensagem (útil quando não há
 * WhatsApp cadastrado). Usado nas seções de Cobranças.
 */
export function ChargeButton({
  nome,
  valor,
  whatsapp,
  descricao,
  compact = false,
}: {
  nome: string;
  valor: string;
  whatsapp?: string | null;
  descricao?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const msg = buildChargeMessage({ nome, valor, descricao });
  const wa = waLink(whatsapp, msg);

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // navegador sem clipboard — ignora silenciosamente
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition"
          title="Abrir WhatsApp com a cobrança pronta"
        >
          <WhatsAppGlyph />
          {compact ? "Cobrar" : "Cobrar no WhatsApp"}
        </a>
      ) : null}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-full border border-fysi-line bg-white text-xs text-fysi-deep px-3 py-1.5 hover:border-fysi-deep/40 transition"
        title="Copiar a mensagem de cobrança"
      >
        {copied ? "✓ Copiado" : "Copiar cobrança"}
      </button>
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.86 9.86 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7C17.17 3.03 14.68 2 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.23-8.23 2.2 0 4.26.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.79.97-.14.16-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}
