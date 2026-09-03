"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOwnProfileAction } from "@/app/admin/actions";

/**
 * Nome da pessoa no topbar (em vez do e-mail) — busca no cliente, como o
 * ProfileAvatar, pra não tocar nos ~20 call-sites do AdminShell. Enquanto
 * carrega (ou sem perfil), mostra o fallback (e-mail) que o servidor já
 * renderiza — sem "pulo" visual de layout.
 */
export function ProfileNameLink({
  urlKey,
  keyParam,
  fallback,
  name: nameFromServer,
}: {
  urlKey?: string | null;
  keyParam: string;
  fallback: string | null;
  /** Nome vindo do servidor. Quando presente, NÃO busca no cliente. */
  name?: string | null;
}) {
  const [fetched, setFetched] = useState<string | null>(null);

  useEffect(() => {
    // Só busca se o servidor não mandou (páginas antigas/sem a prop).
    if (nameFromServer) return;
    void getOwnProfileAction(urlKey ?? null).then((p) => {
      if (p?.name) setFetched(displayName(p.name));
    });
  }, [urlKey, nameFromServer]);

  const name = nameFromServer ? displayName(nameFromServer) : fetched;

  return (
    <Link
      href={`/admin/perfil${keyParam}`}
      className="text-[0.78rem] font-medium text-fysi-deep truncate max-w-[180px] hover:underline"
      title="Meu Perfil"
    >
      {name ?? fallback ?? "Equipe Fysi"}
    </Link>
  );
}

function displayName(raw: string): string {
  if (raw.includes("(sessão compartilhada)")) return "Equipe Fysi";
  return raw;
}
