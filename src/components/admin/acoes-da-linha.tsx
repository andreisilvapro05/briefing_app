"use client";

import { useState, useTransition } from "react";
import { TaskComposer } from "./task-composer";
import { renomearProjetoAction } from "@/app/admin/[id]/actions";

/**
 * As ações que aparecem ao passar o mouse na linha do projeto — o "+" e o
 * lápis do ClickUp.
 *
 * Karine (01/10), com print da lista do ClickUp: "ao passar o mouse pela
 * tarefa ou subtarefa ter um + para adicionar uma tarefa" e "um lápis
 * para poder editar". Antes, lançar uma tarefa num projeto exigia abrir a
 * ficha dele, achar a aba Tarefas e voltar; renomear, idem.
 *
 * Ficam invisíveis até o mouse chegar (e sempre visíveis no teclado, via
 * focus-within) pra não encher uma lista de quarenta linhas de ícone.
 */
export function AcoesDaLinha({
  clientId,
  nome,
  nomeExibicao,
  urlKey,
  onCriou,
  onNovaTarefa,
}: {
  clientId: string;
  /** O nome que está na tela — usado no texto de ajuda. */
  nome: string;
  /** `nome_exibicao` atual: é o campo que o lápis escreve. */
  nomeExibicao: string | null;
  urlKey?: string | null;
  /** A lista é do servidor: sem recarregar, o nome novo não apareceria. */
  onCriou?: () => void;
  /** Abre a barra de criar tarefa, que mora fora da linha. */
  onNovaTarefa: () => void;
}) {
  const [modo, setModo] = useState<"" | "nome">("");
  const [valor, setValor] = useState(nomeExibicao ?? "");
  const [salvando, startTransition] = useTransition();

  function salvarNome() {
    const novo = valor.trim();
    setModo("");
    if (novo === (nomeExibicao ?? "")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("clientId", clientId);
      fd.append("nomeExibicao", novo);
      if (urlKey) fd.append("key", urlKey);
      await renomearProjetoAction(fd);
      onCriou?.();
    });
  }

  if (modo === "nome") {
    return (
      <input
        autoFocus
        value={valor}
        disabled={salvando}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvarNome}
        onKeyDown={(e) => {
          if (e.key === "Enter") salvarNome();
          if (e.key === "Escape") {
            setValor(nomeExibicao ?? "");
            setModo("");
          }
        }}
        placeholder={nome}
        aria-label={`Novo nome para ${nome}`}
        className="min-w-0 flex-1 rounded-[8px] border border-fysi-line bg-white px-2 py-0.5 text-sm text-fysi-deep"
      />
    );
  }

  return (
    <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
      <button
        type="button"
        onClick={onNovaTarefa}
        aria-label={`Adicionar tarefa em ${nome}`}
        title="Adicionar uma tarefa neste projeto"
        className="grid h-6 w-6 place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" {...TRACO}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setModo("nome")}
        aria-label={`Renomear ${nome}`}
        title="Renomear este projeto"
        className="grid h-6 w-6 place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" {...TRACO}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </span>
  );
}

/**
 * A barra de criar tarefa, que mora FORA da linha (ela é um grid; um
 * formulário dentro de uma célula quebraria o alinhamento das colunas).
 */
export function BarraNovaTarefa({
  aberta,
  clientId,
  urlKey,
  meuResponsavel = "",
  onFechar,
}: {
  aberta: boolean;
  clientId: string;
  urlKey?: string | null;
  meuResponsavel?: string;
  onFechar: () => void;
}) {
  if (!aberta) return null;
  return (
    <div className="px-5 pb-3 -mt-1">
      <TaskComposer
        autoFocus
        clientId={clientId}
        defaultResponsavel={meuResponsavel}
        urlKey={urlKey}
        onClose={onFechar}
        placeholder="Nova tarefa neste projeto (Enter adiciona)"
      />
    </div>
  );
}

const TRACO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
