import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Contratos em quadro por status (pedido da Karine 2026-09-05, com
 * referência visual). A tabela continua disponível pelo alternador — ela é
 * melhor pra varrer muitos contratos de uma vez; o quadro é melhor pra ver
 * onde cada um emperrou.
 *
 * O valor fica em verde da marca (--fysi-green): num quadro financeiro é o
 * dado que a pessoa procura primeiro.
 */

export interface ContractCardData {
  id: string;
  cliente: string;
  email: string | null;
  tipo: string | null;
  valor: string;
  pacote: string;
  status: string | null;
  assinadoUrl: string | null;
  atualizadoEm: string;
}

interface Coluna {
  id: string;
  label: string;
  cor: string;
  vazio: string;
}

const COLUNAS: Coluna[] = [
  {
    id: "pendente",
    label: "Aguardando assinatura",
    cor: "#f59e0b",
    vazio: "Nenhum contrato esperando assinatura.",
  },
  {
    id: "assinado",
    label: "Assinado",
    cor: "#4F998A",
    vazio: "Nenhum contrato assinado neste filtro.",
  },
  {
    id: "rejeitado",
    label: "Rejeitado",
    cor: "#ef4444",
    vazio: "Nenhum rejeitado — ótimo sinal.",
  },
  {
    id: "cancelado",
    label: "Cancelado",
    cor: "#94a3b8",
    vazio: "Nenhum cancelado.",
  },
];

export function ContractsBoard({
  contratos,
  keyParam,
  formatDate,
}: {
  contratos: ContractCardData[];
  keyParam: string;
  formatDate: (iso: string) => string;
}) {
  // Status desconhecido/nulo não pode sumir da tela — vira sua própria coluna.
  const conhecidos = new Set(COLUNAS.map((c) => c.id));
  const semStatus = contratos.filter(
    (c) => !c.status || !conhecidos.has(c.status)
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUNAS.map((col) => (
        <ColunaQuadro
          key={col.id}
          coluna={col}
          contratos={contratos.filter((c) => c.status === col.id)}
          keyParam={keyParam}
          formatDate={formatDate}
        />
      ))}
      {semStatus.length > 0 ? (
        <ColunaQuadro
          coluna={{
            id: "sem-status",
            label: "Sem status",
            cor: "#94a3b8",
            vazio: "",
          }}
          contratos={semStatus}
          keyParam={keyParam}
          formatDate={formatDate}
        />
      ) : null}
    </div>
  );
}

function ColunaQuadro({
  coluna,
  contratos,
  keyParam,
  formatDate,
}: {
  coluna: Coluna;
  contratos: ContractCardData[];
  keyParam: string;
  formatDate: (iso: string) => string;
}) {
  return (
    <section className="w-[19rem] shrink-0 rounded-[20px] bg-fysi-cream/60 border border-fysi-line p-3">
      <header className="flex items-center gap-2 px-1.5 pb-3">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: coluna.cor }}
        />
        <h3 className="text-sm font-semibold text-fysi-deep">{coluna.label}</h3>
        <span className="text-xs text-fysi-muted tabular-nums">
          {contratos.length}
        </span>
      </header>

      {contratos.length === 0 ? (
        <p className="px-2 py-8 text-center text-xs text-fysi-muted">
          {coluna.vazio}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {contratos.map((c) => (
            <CartaoContrato
              key={c.id}
              contrato={c}
              keyParam={keyParam}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CartaoContrato({
  contrato,
  keyParam,
  formatDate,
}: {
  contrato: ContractCardData;
  keyParam: string;
  formatDate: (iso: string) => string;
}) {
  const iniciais = (contrato.cliente || "?").slice(0, 2).toUpperCase();

  return (
    <article className="rounded-[14px] border border-fysi-line bg-white p-3.5 shadow-fysi-card transition hover:border-fysi-deep/25">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-fysi-mint/40 text-[0.6rem] font-bold text-fysi-deep">
          {iniciais}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fysi-deep">
            {contrato.cliente}
          </p>
          <p className="truncate text-[0.7rem] text-fysi-muted">
            {contrato.pacote}
          </p>
        </div>
      </div>

      <p
        className="mt-2.5 truncate text-[1.05rem] font-semibold text-fysi-green"
        title={contrato.valor}
      >
        {contrato.valor}
      </p>

      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.1em] text-fysi-muted">
        Atualizado · {formatDate(contrato.atualizadoEm)}
      </p>

      <div className="mt-3 flex items-center gap-3 border-t border-fysi-line pt-2.5">
        <Link
          href={`/admin/${contrato.id}?tab=contrato${
            keyParam ? `&${keyParam.slice(1)}` : ""
          }`}
          className="text-xs font-medium text-fysi-deep hover:underline"
        >
          Abrir →
        </Link>
        {contrato.assinadoUrl ? (
          <a
            href={contrato.assinadoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-fysi-deep hover:underline"
            title="Abrir o PDF assinado"
          >
            ⬇ Assinado
          </a>
        ) : null}
      </div>
    </article>
  );
}

/** Alternador Quadro/Tabela — preserva os filtros ativos na URL. */
export function ViewToggle({
  atual,
  hrefQuadro,
  hrefTabela,
}: {
  atual: "quadro" | "tabela";
  hrefQuadro: string;
  hrefTabela: string;
}): ReactNode {
  const base =
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition";
  return (
    <div className="inline-flex gap-1 rounded-full border border-fysi-line bg-white p-1">
      <Link
        href={hrefQuadro}
        className={`${base} ${
          atual === "quadro"
            ? "bg-fysi-deep text-fysi-cream"
            : "text-fysi-muted hover:bg-fysi-cream"
        }`}
      >
        Quadro
      </Link>
      <Link
        href={hrefTabela}
        className={`${base} ${
          atual === "tabela"
            ? "bg-fysi-deep text-fysi-cream"
            : "text-fysi-muted hover:bg-fysi-cream"
        }`}
      >
        Tabela
      </Link>
    </div>
  );
}
