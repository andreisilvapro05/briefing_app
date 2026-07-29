"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildChargeMessage,
  waLink,
  PAYMENT_LINKS,
  FYSI_ASAAS_LINK,
} from "@/lib/cobranca-message";

/**
 * Botão de cobrança: abre um popover onde você escolhe o link de pagamento
 * salvo (Asaas) e dispara a cobrança pelo WhatsApp com a mensagem pronta
 * (Pix + cartão + valor), ou copia a mensagem. Usado nas seções de Cobranças.
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
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Link escolhido: "" = link padrão da Fysi; ou o id de um PAYMENT_LINKS.
  const [linkId, setLinkId] = useState("");
  // Posição fixa do popover (medida do botão) — evita corte em tabelas com
  // overflow. { top, left } em coordenadas de viewport.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const chosen = PAYMENT_LINKS.find((l) => l.id === linkId);
  const link = chosen?.url ?? FYSI_ASAAS_LINK;
  const msg = buildChargeMessage({ nome, valor, descricao, link });
  const wa = waLink(whatsapp, msg);

  const PANEL_W = 288; // w-72

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        const left = Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8));
        setPos({ top: r.bottom + 6, left });
      }
      return next;
    });
  }

  // Fecha o popover ao clicar fora ou ao rolar a página.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

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
    <div className="inline-block" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition"
        title="Cobrar este cliente"
      >
        <WhatsAppGlyph />
        {compact ? "Cobrar" : "Cobrar no WhatsApp"}
      </button>

      {open && pos ? (
        <div
          className="fixed z-50 w-72 rounded-[14px] border border-fysi-line bg-white p-3 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <label className="block text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-medium mb-1">
            Link de pagamento (cartão)
          </label>
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            className="w-full rounded-[10px] border border-fysi-line bg-white px-2.5 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          >
            <option value="">Link padrão da Fysi</option>
            {PAYMENT_LINKS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>

          <p className="mt-2 text-[0.7rem] text-fysi-muted break-all">
            {link}
          </p>

          <div className="mt-3 flex items-center gap-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 text-white text-xs font-medium px-3 py-2 hover:bg-emerald-700 transition"
              >
                <WhatsAppGlyph />
                Abrir WhatsApp
              </a>
            ) : (
              <span className="flex-1 text-[0.7rem] text-fysi-muted">
                Sem WhatsApp cadastrado
              </span>
            )}
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-full border border-fysi-line bg-white text-xs text-fysi-deep px-3 py-2 hover:border-fysi-deep/40 transition"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      ) : null}
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
