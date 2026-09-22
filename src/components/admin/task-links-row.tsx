"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTaskLinkTargetsAction } from "@/app/admin/[id]/actions";
import type { LinkTarget } from "@/lib/task-links";

/**
 * Páginas do app ligadas a uma demanda — o equivalente às "Páginas" que a
 * tarefa carrega no ClickUp (lá, "Copy LP Raynna" traz "EI - Raynna Felix" e
 * "Rayanna" logo abaixo do título).
 *
 * Antes havia um único link "Criar Estrutura Inicial": quem pegava a demanda
 * não tinha como chegar no briefing do cliente sem voltar ao menu e procurar.
 *
 * Busca sob demanda (só quando a demanda é aberta): são duas consultas por
 * cliente e a tela de Tarefas renderiza dezenas de linhas.
 */
export function TaskLinks({
  clientId,
  urlKey,
}: {
  clientId: string | null;
  urlKey?: string | null;
}) {
  const [alvos, setAlvos] = useState<LinkTarget[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    getTaskLinkTargetsAction(clientId, urlKey ?? null)
      .then((d) => {
        if (vivo) setAlvos(d);
      })
      .catch(() => {
        if (vivo) {
          setErro(true);
          setAlvos([]);
        }
      });
    return () => {
      vivo = false;
    };
  }, [clientId, urlKey]);

  if (erro) {
    return (
      <p className="text-xs text-fysi-muted">
        Não consegui carregar as páginas ligadas a esta demanda.
      </p>
    );
  }
  if (alvos === null) {
    return (
      <div className="flex gap-2" aria-hidden>
        <span className="h-7 w-32 rounded-full bg-fysi-line/50 animate-pulse" />
        <span className="h-7 w-24 rounded-full bg-fysi-line/50 animate-pulse" />
      </div>
    );
  }
  if (alvos.length === 0) return null;

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1.5">
        Páginas
      </p>
      <div className="flex flex-wrap gap-1.5">
        {alvos.map((a) => (
          <Chip key={a.id} alvo={a} />
        ))}
      </div>
    </div>
  );
}

function Chip({ alvo }: { alvo: LinkTarget }) {
  // Link externo (drive, painel do cliente) abre em aba nova; página do
  // admin navega na mesma aba, pra não encher o navegador de abas.
  const externo = /^https?:\/\//.test(alvo.href) || alvo.href.startsWith("/painel/");
  const classe = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition max-w-[16rem] ${
    alvo.existe
      ? "border-fysi-line bg-white text-fysi-deep hover:border-fysi-deep/40"
      : "border-dashed border-fysi-line-strong bg-transparent text-fysi-muted hover:text-fysi-deep hover:border-fysi-deep/40"
  }`;
  const conteudo = (
    <>
      <PageIcon />
      <span className="truncate">{alvo.label}</span>
      {!alvo.existe ? (
        <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.08em] text-amber-700">
          criar
        </span>
      ) : null}
    </>
  );

  if (externo) {
    return (
      <a href={alvo.href} target="_blank" rel="noopener noreferrer" className={classe}>
        {conteudo}
      </a>
    );
  }
  return (
    <Link href={alvo.href} className={classe}>
      {conteudo}
    </Link>
  );
}

function PageIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}
