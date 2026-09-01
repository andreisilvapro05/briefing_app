"use client";

import { useState, useTransition } from "react";
import { generateMemberAccessLinkAction } from "@/app/admin/membros/actions";

/**
 * Botão "Gerar link de acesso" por membro — gera um link direto (sem
 * e-mail) que o admin copia e manda pra pessoa (WhatsApp). Contorna o
 * Resend em modo de teste que não entrega e-mail. O link loga a pessoa e
 * liga a conta dela (auth_user_id) na primeira vez.
 */
export function MemberAccessLinkButton({
  memberId,
  urlKey,
}: {
  memberId: string;
  urlKey: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateMemberAccessLinkAction(memberId, urlKey);
      if ("error" in res) {
        setError("Não consegui gerar o link. Tenta de novo.");
        return;
      }
      setLink(res.link);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie o link manualmente.");
    }
  }

  if (link) {
    return (
      <div className="flex flex-col items-end gap-1 max-w-[16rem]">
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="w-40 rounded-[8px] border border-fysi-line bg-fysi-cream/40 px-2 py-1 text-xs text-fysi-deep"
          />
          <button
            type="button"
            onClick={copy}
            className="rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-2.5 py-1 hover:bg-fysi-deep/90"
          >
            {copied ? "✓" : "Copiar"}
          </button>
        </div>
        <span className="text-[0.68rem] text-fysi-muted text-right">
          Mande por WhatsApp. Vale por 1 hora.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="text-xs font-medium text-fysi-deep hover:underline disabled:opacity-50"
      >
        {pending ? "Gerando…" : "🔗 Gerar link de acesso"}
      </button>
      {error ? <span className="text-[0.68rem] text-red-600">{error}</span> : null}
    </div>
  );
}
