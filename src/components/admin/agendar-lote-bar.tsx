"use client";

import { useState, useTransition } from "react";
import { agendarTarefasEmLoteAction } from "@/app/admin/[id]/actions";
import { hojeEmBrasilia } from "@/lib/datas";

/**
 * Barra de agendar um lote de etapas de um projeto.
 *
 * Pedido da Karine (26/09): "os projetos sem datas o Andrei mesmo coloca
 * datas". O gesto real é agendar UM PROJETO por vez — é o que ele fazia
 * duplicando a pasta no ClickUp —, por isso a barra vive dentro do grupo
 * do cliente, e não no topo da tela.
 *
 * O intervalo é em dias úteis porque o prazo da agência é contado assim
 * ("12 dias úteis"). Zero põe todas no mesmo dia, que também é pedido de
 * verdade quando o lote é uma leva só.
 */
export function AgendarLoteBar({
  taskIds,
  urlKey,
  onPronto,
}: {
  /** Na ordem em que aparecem na tela — é a ordem das etapas. */
  taskIds: string[];
  urlKey?: string | null;
  onPronto: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState(hojeEmBrasilia());
  const [intervalo, setIntervalo] = useState(2);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function agendar() {
    setErro(null);
    const fd = new FormData();
    fd.append("taskIds", JSON.stringify(taskIds));
    fd.append("inicio", inicio);
    fd.append("intervalo", String(intervalo));
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      const r = await agendarTarefasEmLoteAction(fd);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAberto(false);
      onPronto();
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs text-fysi-deep hover:underline underline-offset-2 font-medium shrink-0"
        title={`Dar data às ${taskIds.length} etapas deste projeto, em sequência`}
      >
        Agendar {taskIds.length} →
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="inline-flex items-center gap-1.5 text-fysi-muted">
        Começa em
        <input
          type="date"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="rounded-[6px] border border-fysi-line bg-white px-1.5 py-1 text-fysi-deep"
        />
      </label>
      <label className="inline-flex items-center gap-1.5 text-fysi-muted">
        a cada
        <input
          type="number"
          min={0}
          max={60}
          value={intervalo}
          onChange={(e) => setIntervalo(Number(e.target.value))}
          className="w-14 rounded-[6px] border border-fysi-line bg-white px-1.5 py-1 text-fysi-deep tabular-nums"
        />
        dias úteis
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={agendar}
        className="rounded-full bg-fysi-deep text-fysi-cream px-3 py-1 font-medium disabled:opacity-50"
      >
        {pending ? "Agendando…" : `Aplicar a ${taskIds.length}`}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="text-fysi-muted hover:text-fysi-deep"
      >
        Cancelar
      </button>
      {erro ? (
        <span role="alert" className="text-red-700">
          {erro}
        </span>
      ) : null}
    </div>
  );
}
