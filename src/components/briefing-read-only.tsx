import type { PartialBlock } from "@blocknote/core";
import type { ReactNode } from "react";

/**
 * Renderiza blocos do BlockNote em HTML, SEM carregar o editor.
 *
 * Por que não reusar o EIView: o BlockNote só roda no browser — montá-lo
 * numa página pública derrubaria o SSR (foi exatamente o 500 das telas de
 * EI/briefing em 2026-09) e faria o cliente baixar um editor inteiro só pra
 * ler. Aqui é leitura, então sai HTML puro do servidor.
 *
 * Também é o que dá pra usar na visão interna quando não se quer editar.
 */

interface InlineNode {
  type?: string;
  text?: string;
  href?: string;
  styles?: Record<string, boolean>;
  content?: InlineNode[];
}

function Inline({ nodes }: { nodes: InlineNode[] }): ReactNode {
  return nodes.map((n, i) => {
    if (n.type === "link" && Array.isArray(n.content)) {
      return (
        <a
          key={i}
          href={n.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-fysi-deep underline decoration-fysi-mint-vivid decoration-2 underline-offset-2 hover:decoration-fysi-deep break-all"
        >
          <Inline nodes={n.content} />
        </a>
      );
    }
    const t = n.text ?? "";
    if (!t) return null;
    const s = n.styles ?? {};
    let el: ReactNode = t;
    if (s.code)
      el = (
        <code className="font-mono text-[0.9em] bg-fysi-cream px-1 py-0.5 rounded">
          {el}
        </code>
      );
    if (s.italic) el = <em>{el}</em>;
    if (s.bold) el = <strong className="font-semibold text-fysi-deep">{el}</strong>;
    if (s.underline) el = <u>{el}</u>;
    if (s.strike) el = <s>{el}</s>;
    return <span key={i}>{el}</span>;
  });
}

function conteudo(b: PartialBlock): InlineNode[] {
  const c = (b as { content?: unknown }).content;
  return Array.isArray(c) ? (c as InlineNode[]) : [];
}

function vazio(b: PartialBlock): boolean {
  return conteudo(b).every((n) => !(n.text ?? "").trim() && n.type !== "link");
}

/** Caixinha marcada/desmarcada — SVG, sem emoji. */
function Caixa({ marcada }: { marcada: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-[0.2em] shrink-0 inline-flex items-center justify-center h-[1.05em] w-[1.05em] rounded-[4px] border ${
        marcada
          ? "bg-fysi-deep border-fysi-deep text-fysi-cream"
          : "bg-white border-fysi-line-strong"
      }`}
    >
      {marcada ? (
        <svg viewBox="0 0 12 12" className="h-[0.7em] w-[0.7em]" fill="none">
          <path
            d="M2.5 6.2l2.2 2.2L9.5 3.6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export function BriefingReadOnly({ blocks }: { blocks: PartialBlock[] }) {
  if (!blocks.length) {
    return (
      <p className="text-fysi-muted text-sm">Este briefing ainda está vazio.</p>
    );
  }

  const saida: ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const b = blocks[i];
    const tipo = (b as { type?: string }).type;
    const props = (b as { props?: Record<string, unknown> }).props ?? {};

    // Agrupa itens seguidos do mesmo tipo numa lista só — senão cada item
    // vira <ul> sozinho e o espaçamento fica irregular.
    if (
      tipo === "bulletListItem" ||
      tipo === "numberedListItem" ||
      tipo === "checkListItem"
    ) {
      const grupo: PartialBlock[] = [];
      while (i < blocks.length && (blocks[i] as { type?: string }).type === tipo) {
        grupo.push(blocks[i]);
        i += 1;
      }
      const chave = `l${i}`;
      if (tipo === "checkListItem") {
        saida.push(
          <ul key={chave} className="my-3 flex flex-col gap-1.5">
            {grupo.map((g, k) => {
              const marcada = Boolean(
                (g as { props?: { checked?: boolean } }).props?.checked
              );
              return (
                <li
                  key={k}
                  className={`flex items-start gap-2.5 text-[0.95rem] leading-relaxed ${
                    marcada ? "text-fysi-deep" : "text-fysi-muted"
                  }`}
                >
                  <Caixa marcada={marcada} />
                  <span className={marcada ? "font-medium" : ""}>
                    <Inline nodes={conteudo(g)} />
                  </span>
                </li>
              );
            })}
          </ul>
        );
      } else if (tipo === "numberedListItem") {
        saida.push(
          <ol
            key={chave}
            className="my-3 list-decimal pl-6 flex flex-col gap-1 text-[0.95rem] leading-relaxed text-fysi-deep marker:text-fysi-muted"
          >
            {grupo.map((g, k) => (
              <li key={k} className={vazio(g) ? "text-fysi-line-strong" : ""}>
                {vazio(g) ? "—" : <Inline nodes={conteudo(g)} />}
              </li>
            ))}
          </ol>
        );
      } else {
        saida.push(
          <ul
            key={chave}
            className="my-3 list-disc pl-6 flex flex-col gap-1 text-[0.95rem] leading-relaxed text-fysi-deep marker:text-fysi-mint-vivid"
          >
            {grupo.map((g, k) => (
              <li key={k}>
                <Inline nodes={conteudo(g)} />
              </li>
            ))}
          </ul>
        );
      }
      continue;
    }

    i += 1;

    if (tipo === "divider") {
      saida.push(<hr key={i} className="my-7 border-fysi-line" />);
      continue;
    }

    if (tipo === "image") {
      const url = props.url as string | undefined;
      if (!url) continue;
      const caption = (props.caption as string | undefined) ?? "";
      saida.push(
        <figure key={i} className="my-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={caption || "Imagem do briefing"}
            loading="lazy"
            className="max-w-full rounded-[12px] border border-fysi-line"
          />
          {caption ? (
            <figcaption className="text-xs text-fysi-muted mt-1.5">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      );
      continue;
    }

    if (tipo === "codeBlock") {
      saida.push(
        <pre
          key={i}
          className="my-4 bg-fysi-cream/70 border border-fysi-line rounded-[12px] p-3 text-xs overflow-x-auto font-mono text-fysi-deep"
        >
          {conteudo(b)
            .map((n) => n.text ?? "")
            .join("")}
        </pre>
      );
      continue;
    }

    if (tipo === "heading") {
      const nivel = Number(props.level ?? 2);
      const nodes = conteudo(b);
      if (nivel <= 1) {
        saida.push(
          <h2
            key={i}
            className="text-2xl font-semibold tracking-tight text-fysi-deep mt-8 mb-2 first:mt-0"
          >
            <Inline nodes={nodes} />
          </h2>
        );
      } else if (nivel === 2) {
        saida.push(
          <h3
            key={i}
            className="text-xl font-semibold tracking-tight text-fysi-deep mt-7 mb-2 first:mt-0"
          >
            <Inline nodes={nodes} />
          </h3>
        );
      } else {
        saida.push(
          <h4
            key={i}
            className="text-base font-semibold text-fysi-deep mt-6 mb-1.5 first:mt-0"
          >
            <Inline nodes={nodes} />
          </h4>
        );
      }
      continue;
    }

    // paragraph e qualquer tipo desconhecido caem aqui.
    if (vazio(b)) continue;
    const fundoAviso = props.backgroundColor === "yellow";
    saida.push(
      <p
        key={i}
        className={
          fundoAviso
            ? "my-3 text-sm text-fysi-deep bg-fysi-yellow/30 border border-fysi-yellow rounded-[10px] px-3 py-2"
            : "my-2 text-[0.95rem] leading-relaxed text-fysi-deep"
        }
      >
        <Inline nodes={conteudo(b)} />
      </p>
    );
  }

  return <div className="briefing-leitura">{saida}</div>;
}
