"use client";

import { useState, useTransition } from "react";
import { updateOwnPasswordAction } from "@/app/admin/actions";

/**
 * Troca da própria senha no Meu Perfil. Fechado por padrão (é ação rara);
 * abre num clique. Só aparece pra quem tem login individual.
 */
export function PasswordChanger({
  urlKey,
  canChange,
}: {
  urlKey: string | null;
  canChange: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canChange) {
    return (
      <p className="text-xs text-fysi-muted">
        Sessão de senha compartilhada não tem senha própria — entre com seu
        login individual pra poder trocar.
      </p>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nova !== repetir) {
      setError("A nova senha e a repetição não batem.");
      return;
    }
    if (nova.length < 8) {
      setError("A nova senha precisa de pelo menos 8 caracteres.");
      return;
    }
    const fd = new FormData();
    fd.append("atual", atual);
    fd.append("nova", nova);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      const res = await updateOwnPasswordAction(fd);
      if (!res.ok) {
        setError(humanError(res.error));
        return;
      }
      setOk(true);
      setAtual("");
      setNova("");
      setRepetir("");
      setOpen(false);
      window.setTimeout(() => setOk(false), 4000);
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-fysi-deep hover:underline"
        >
          🔒 Trocar minha senha
        </button>
        {ok ? (
          <span className="text-xs text-fysi-deep font-medium">
            Senha alterada ✓
          </span>
        ) : null}
      </div>
    );
  }

  const inputClass =
    "w-full rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fysi-muted">Senha atual</span>
        <input
          type="password"
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fysi-muted">Nova senha (mín. 8)</span>
        <input
          type="password"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fysi-muted">Repita a nova senha</span>
        <input
          type="password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !atual || !nova || !repetir}
          className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar nova senha"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-sm text-fysi-muted hover:text-fysi-deep"
        >
          cancelar
        </button>
      </div>
    </form>
  );
}

function humanError(code: string): string {
  switch (code) {
    case "senha-atual-incorreta":
      return "Senha atual incorreta.";
    case "senha-curta":
      return "A nova senha precisa de pelo menos 8 caracteres.";
    case "senha-igual":
      return "A nova senha precisa ser diferente da atual.";
    case "sessao-sem-identidade-propria":
      return "Essa sessão não tem senha própria.";
    default:
      return "Não consegui trocar a senha. Tenta de novo.";
  }
}
