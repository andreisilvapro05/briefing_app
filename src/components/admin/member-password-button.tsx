"use client";

import { useState, useTransition } from "react";
import { setMemberPasswordAction } from "@/app/admin/membros/actions";

/**
 * "🔑 Definir senha" por membro — gera uma senha forte no servidor e
 * mostra UMA vez pro admin copiar e mandar pra pessoa (junto com o
 * e-mail dela, em /admin/login). Também serve pra resetar senha
 * esquecida. Não depende de e-mail chegar.
 */
export function MemberPasswordButton({
  memberId,
  memberName,
  urlKey,
}: {
  memberId: string;
  memberName: string;
  urlKey: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    if (
      !window.confirm(
        `Definir uma senha nova pra ${memberName}? Se já existir uma senha, ela é substituída.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setMemberPasswordAction(memberId, urlKey);
      if ("error" in res) {
        setError("Não consegui definir a senha. Tenta de novo.");
        return;
      }
      setPassword(res.password);
    });
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie a senha manualmente.");
    }
  }

  if (password) {
    return (
      <div className="flex flex-col items-end gap-1 max-w-[16rem]">
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={password}
            onFocus={(e) => e.currentTarget.select()}
            className="w-36 rounded-[8px] border border-fysi-line bg-fysi-cream/40 px-2 py-1 text-xs font-mono text-fysi-deep"
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
          Anota agora — não dá pra ver de novo (só gerar outra).
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
        {pending ? "Gerando…" : "🔑 Definir senha"}
      </button>
      {error ? <span className="text-[0.68rem] text-red-600">{error}</span> : null}
    </div>
  );
}
