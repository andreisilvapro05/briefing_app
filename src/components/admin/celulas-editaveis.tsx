"use client";

import { useState, useTransition } from "react";
import { TEAM_MEMBERS } from "@/lib/project-tasks";
import { hojeEmBrasilia, formatDataCurta, dataEmLinguagem } from "@/lib/datas";
import { editarCampoDoProjetoAction } from "@/app/admin/[id]/actions";

/**
 * Responsável e datas DO PROJETO, editáveis na própria linha.
 *
 * Karine (01/10): "precisa ser editável como é no ClickUp". A linha era
 * só-leitura por um motivo que deixou de valer — até 28/09 o projeto não
 * tinha esses campos próprios, e editar ali mudaria uma TAREFA escolhida
 * por regra, sem a pessoa ver qual. Hoje a coluna mostra o campo do
 * projeto e é nele que a edição escreve.
 *
 * O valor novo aparece na hora e VOLTA SOZINHO se o servidor recusar:
 * deixar na tela o que não salvou é a tela mentindo. Mesmo padrão de
 * `areas-board.tsx`.
 */

function useCampo(clientId: string, campo: string, urlKey?: string | null) {
  const [salvando, startTransition] = useTransition();
  const [erro, setErro] = useState(false);

  function salvar(valor: string, reverter: () => void) {
    setErro(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("clientId", clientId);
      fd.append("campo", campo);
      fd.append("valor", valor);
      if (urlKey) fd.append("key", urlKey);
      try {
        const r = await editarCampoDoProjetoAction(fd);
        if (!r.ok) {
          reverter();
          setErro(true);
        }
      } catch {
        reverter();
        setErro(true);
      }
    });
  }
  return { salvando, erro, salvar };
}

export function CelulaResponsavelEditavel({
  clientId,
  valor,
  tarefa,
  urlKey,
  somenteLeitura = false,
}: {
  clientId: string;
  valor: string | null;
  tarefa: string | null;
  urlKey?: string | null;
  somenteLeitura?: boolean;
}) {
  const [atual, setAtual] = useState(valor ?? "");
  const [abrindo, setAbrindo] = useState(false);
  const { salvando, erro, salvar } = useCampo(clientId, "responsavel", urlKey);
  const m = TEAM_MEMBERS.find((x) => x.value === atual);

  if (somenteLeitura) {
    return m ? (
      <span
        className={`w-6 h-6 rounded-full grid place-items-center text-[0.6rem] font-bold text-white ${m.cor}`}
        title={tarefa ? `${m.label} — ${tarefa}` : m.label}
      >
        {m.iniciais}
      </span>
    ) : (
      <span className="text-fysi-muted text-xs" title="Sem responsável">—</span>
    );
  }

  if (abrindo) {
    return (
      <select
        autoFocus
        disabled={salvando}
        value={atual}
        onBlur={() => setAbrindo(false)}
        onChange={(e) => {
          const anterior = atual;
          const novo = e.target.value;
          setAtual(novo);
          setAbrindo(false);
          salvar(novo, () => setAtual(anterior));
        }}
        className="rounded-[8px] border border-fysi-line bg-white text-xs px-1 py-0.5 text-fysi-deep"
      >
        <option value="">Sem responsável</option>
        {TEAM_MEMBERS.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      disabled={salvando}
      onClick={() => setAbrindo(true)}
      title={
        erro
          ? "Não salvou — tente de novo"
          : m
            ? `${m.label}${tarefa ? ` — ${tarefa}` : ""} · clique pra trocar`
            : "Sem responsável · clique pra definir"
      }
      className={`rounded-full transition disabled:opacity-50 ${erro ? "ring-2 ring-red-400" : ""}`}
    >
      {m ? (
        <span
          className={`w-6 h-6 rounded-full grid place-items-center text-[0.6rem] font-bold text-white ${m.cor}`}
        >
          {m.iniciais}
        </span>
      ) : (
        <span className="w-6 h-6 rounded-full grid place-items-center text-xs text-fysi-muted border border-dashed border-fysi-line hover:border-fysi-deep/40">
          +
        </span>
      )}
    </button>
  );
}

export function CelulaDataEditavel({
  clientId,
  campo,
  iso,
  rotulo,
  urlKey,
  alertaSeVencida = false,
  somenteLeitura = false,
}: {
  clientId: string;
  campo: "data_inicial" | "data_vencimento";
  iso: string | null;
  rotulo: string;
  urlKey?: string | null;
  alertaSeVencida?: boolean;
  somenteLeitura?: boolean;
}) {
  const [atual, setAtual] = useState(iso ?? "");
  const [abrindo, setAbrindo] = useState(false);
  const { salvando, erro, salvar } = useCampo(clientId, campo, urlKey);

  const hoje = hojeEmBrasilia();
  const vencida = alertaSeVencida && Boolean(atual) && atual < hoje;

  const texto = atual ? (
    /* Data em linguagem, como o ClickUp: numa lista longa o que importa é
       a distância até hoje, não o número do dia. A data exata fica no
       title, pra quem precisar dela. */
    <span className={vencida ? "text-red-600 font-medium" : "text-fysi-muted"}>
      {dataEmLinguagem(atual, hoje)}
    </span>
  ) : (
    <span className="text-fysi-muted">—</span>
  );

  if (somenteLeitura) {
    return (
      <span
        className="text-xs"
        title={atual ? `${rotulo}: ${formatDataCurta(atual)}` : rotulo}
      >
        {texto}
      </span>
    );
  }

  if (abrindo) {
    return (
      <input
        type="date"
        autoFocus
        disabled={salvando}
        defaultValue={atual}
        onBlur={(e) => {
          setAbrindo(false);
          const novo = e.target.value;
          if (novo === atual) return;
          const anterior = atual;
          setAtual(novo);
          salvar(novo, () => setAtual(anterior));
        }}
        className="w-full rounded-[8px] border border-fysi-line bg-white text-xs px-1 py-0.5 text-fysi-deep"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={salvando}
      onClick={() => setAbrindo(true)}
      title={
        erro
          ? "Não salvou — tente de novo"
          : `${rotulo}${atual ? `: ${formatDataCurta(atual)}` : " não definido"} · clique pra mudar`
      }
      className={`text-xs text-left w-full rounded px-0.5 hover:bg-fysi-cream/70 transition disabled:opacity-50 ${erro ? "ring-2 ring-red-400" : ""}`}
    >
      {texto}
    </button>
  );
}
