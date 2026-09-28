"use client";

import { useEffect } from "react";
import { dataEmLinguagem, formatDataCurta, hojeEmBrasilia } from "@/lib/datas";
import { TEAM_MEMBERS } from "@/lib/project-tasks";
import type { LinhaDoProjeto } from "@/lib/linha-do-projeto";

/**
 * Resumo do projeto em cima da lista, sem trocar de tela.
 *
 * Karine (28/09): "ao clicar aparecer resuminho em pop up para não ir para
 * outra tela, ter botão de ver detalhes cliente".
 *
 * Por que importa: quem está varrendo a lista quer conferir um projeto e
 * seguir varrendo. Abrir a ficha inteira custa uma navegação de ida e
 * outra de volta, e perde a rolagem — a pessoa volta e não sabe mais onde
 * estava.
 *
 * NÃO mostra valor de contrato nem pagamento de propósito: este componente
 * não recebe o membro logado, e a designer ("basico") vê esta lista. Sem
 * poder checar hasFinanceAccess aqui, o certo é não ter o dado.
 */

export interface ResumoProjetoDados {
  id: string;
  nome: string;
  tipo: string;
  statusLabel: string;
  statusCor: string;
  linha: LinhaDoProjeto;
  progresso: { total: number; fechadas: number } | null;
  semRetorno: boolean;
  href: string;
}

export function ResumoProjeto({
  dados,
  onFechar,
}: {
  dados: ResumoProjetoDados | null;
  onFechar: () => void;
}) {
  // Esc fecha. Sem isso, um painel sobreposto vira armadilha pra quem
  // navega por teclado.
  //
  // `onFechar` entra nas dependências em vez de ir por ref: a regra
  // react-hooks/refs do compilador recusa escrever em ref durante o
  // render, e a dependência resolve o mesmo problema sem truque.
  useEffect(() => {
    if (!dados) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dados, onFechar]);

  if (!dados) return null;

  const hoje = hojeEmBrasilia();
  const m = TEAM_MEMBERS.find((x) => x.value === dados.linha.responsavel);
  const pct =
    dados.progresso && dados.progresso.total > 0
      ? Math.round((dados.progresso.fechadas / dados.progresso.total) * 100)
      : null;
  const vencida =
    dados.linha.dataVencimento != null && dados.linha.dataVencimento < hoje;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Resumo de ${dados.nome}`}
      className="fixed inset-0 z-50 grid place-items-center p-4"
    >
      {/* O fundo fecha ao clique — é o gesto que todo mundo tenta antes de
          procurar o X. */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-fysi-deep/20 backdrop-blur-[1px]"
      />
      <div className="relative w-full max-w-md rounded-[18px] border border-fysi-line bg-white shadow-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fysi-deep break-words">
              {dados.nome}
            </h2>
            <p className="text-xs text-fysi-muted mt-0.5">{dados.tipo}</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar resumo"
            className="shrink-0 h-7 w-7 grid place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-fysi-deep">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: dados.statusCor }}
              aria-hidden="true"
            />
            {dados.statusLabel}
          </span>
          {dados.semRetorno ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-amber-600"
              title="O cliente não dá retorno há 14 dias ou mais"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
                <path d="M12 10v4M12 17.5v.01" />
              </svg>
              sem retorno
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-fysi-muted">
              Responsável
            </dt>
            <dd className="text-fysi-deep mt-0.5">{m?.label ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-fysi-muted">
              Progresso
            </dt>
            <dd className="text-fysi-deep mt-0.5 tabular-nums">
              {dados.progresso && dados.progresso.total > 0
                ? `${dados.progresso.fechadas}/${dados.progresso.total} (${pct}%)`
                : "sem tarefas"}
            </dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-fysi-muted">
              Início
            </dt>
            <dd className="text-fysi-deep mt-0.5">
              {dados.linha.dataInicial
                ? formatDataCurta(dados.linha.dataInicial)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-fysi-muted">
              Vencimento
            </dt>
            <dd
              className={`mt-0.5 ${vencida ? "text-red-600 font-medium" : "text-fysi-deep"}`}
            >
              {dados.linha.dataVencimento
                ? `${formatDataCurta(dados.linha.dataVencimento)} · ${dataEmLinguagem(dados.linha.dataVencimento, hoje)}`
                : "—"}
            </dd>
          </div>
        </dl>

        {dados.linha.tarefa ? (
          <p className="mt-4 text-xs text-fysi-muted border-t border-fysi-line pt-3">
            A data vem de <span className="text-fysi-deep">{dados.linha.tarefa}</span>
          </p>
        ) : null}

        <a
          href={dados.href}
          className="mt-4 inline-flex items-center justify-center w-full rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90 transition"
        >
          Ver detalhes do cliente →
        </a>
      </div>
    </div>
  );
}
