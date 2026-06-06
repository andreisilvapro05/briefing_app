"use client";

import { useState } from "react";

/**
 * Botão "Copiar link /contratar" no header do /admin.
 *
 * Tem 2 ações:
 *   - Click curto: copia o link pra clipboard, mostra "Copiado ✓" por 2s
 *   - Ícone WhatsApp ao lado: abre share sheet do WhatsApp/Web com texto
 *     pré-preenchido e o link.
 *
 * Mensagem padrão pré-pronta — admin pode ajustar editando aqui.
 */
export function ShareContratarButton() {
  const [copied, setCopied] = useState(false);

  const link = "https://app.fysilabdigital.com.br/contratar";
  const mensagem = `Oi! Tudo bem? Pra a gente fechar o seu projeto e começar a produção, preenche teus dados rapidinho nesse link 👇\n\n${link}\n\nLeva 3 minutinhos. Qualquer dúvida, chama 💚`;

  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function openWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="inline-flex items-center rounded-full border border-fysi-line bg-white overflow-hidden">
      <button
        type="button"
        onClick={copy}
        title="Copiar link de contratação"
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-fysi-deep hover:bg-fysi-cream/50 transition"
      >
        {copied ? "✓ Copiado" : "🔗 Link /contratar"}
      </button>
      <button
        type="button"
        onClick={openWhatsApp}
        title="Compartilhar pelo WhatsApp"
        aria-label="Compartilhar pelo WhatsApp"
        className="inline-flex items-center px-2.5 py-2 border-l border-fysi-line text-sm text-fysi-deep hover:bg-fysi-mint/40 transition"
      >
        💬
      </button>
    </div>
  );
}
