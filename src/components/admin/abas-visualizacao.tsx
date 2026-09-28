import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Seletor de visualização dos projetos — "Por status", "Quadro" e "Tarefas"
 * são o MESMO dado (os projetos e suas tarefas) visto de três jeitos, como as
 * views de uma lista do ClickUp.
 *
 * Pedido da Karine (27/09), com seta no print do menu lateral: "trazer
 * clareza, tire essas abas a princípio que repetem e coloque como
 * visualização em outras se preciso". As três eram itens de primeiro nível do
 * menu e nada na tela dizia que eram parentes: trocar de visão era voltar pro
 * menu e adivinhar qual das três mostrava o que se queria.
 *
 * Não é o ViewTabs: em "Por status" e "Tarefas" ele já está logo abaixo,
 * recortando por pessoa. Duas barras de abas sublinhadas empilhadas fariam a
 * tela parecer ter dois níveis do mesmo tipo de aba — aqui o grupo de pílulas
 * se lê como "qual visão", e a barra de baixo continua sendo "de quem".
 *
 * Só links: quem decide o conteúdo é o servidor em cada rota, e as URLs são
 * as de sempre (/admin/lista, /admin/quadro, /admin/tarefas).
 */

function I({ children }: { children: ReactNode }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/**
 * Os ícones são os MESMOS do menu (ver ICONS em admin-shell.tsx): a pílula
 * acesa aqui e a subaba acesa lá têm que se reconhecer como a mesma coisa.
 */
const VISUALIZACOES = [
  {
    id: "lista",
    label: "Por status",
    path: "/admin/lista",
    icon: (
      <I>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </I>
    ),
  },
  {
    id: "quadro",
    label: "Quadro",
    path: "/admin/quadro",
    icon: (
      <I>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M15 3v18" />
      </I>
    ),
  },
  {
    id: "tarefas",
    label: "Tarefas",
    path: "/admin/tarefas",
    icon: (
      <I>
        <rect x="3" y="5" width="4" height="4" rx="1" />
        <path d="M9 7h12" />
        <rect x="3" y="15" width="4" height="4" rx="1" />
        <path d="M9 17h12" />
      </I>
    ),
  },
] as const;

export type Visualizacao = (typeof VISUALIZACOES)[number]["id"];

export function AbasVisualizacao({
  ativa,
  keyParam,
}: {
  ativa: Visualizacao;
  /** "?key=..." da sessão por URL — sem ele a troca de visão desloga. */
  keyParam: string;
}) {
  return (
    <nav aria-label="Visualização dos projetos" className="mb-5">
      <ul className="inline-flex items-center gap-1 rounded-full border border-fysi-line bg-white p-1">
        {VISUALIZACOES.map((v) => {
          const atual = v.id === ativa;
          return (
            <li key={v.id}>
              <Link
                href={`${v.path}${keyParam}`}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.82rem] font-medium whitespace-nowrap transition",
                  atual
                    ? "bg-fysi-deep text-fysi-cream"
                    : "text-fysi-muted hover:bg-fysi-cream hover:text-fysi-deep"
                )}
              >
                {v.icon}
                {v.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
