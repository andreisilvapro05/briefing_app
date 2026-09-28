"use client";

import { useState, useTransition } from "react";
import {
  syncClickUpStatusAction,
  type SyncResultado,
} from "@/app/admin/lista/actions";

/**
 * "Sincronizar do ClickUp" — puxa o status atual de cada projeto.
 * Mostra o que mudou, em vez de só dizer "pronto": saber QUAIS projetos
 * andaram é metade do valor da sincronização.
 */
export function ClickUpSyncButton({ urlKey }: { urlKey: string | null }) {
  const [pending, startTransition] = useTransition();
  const [res, setRes] = useState<SyncResultado | null>(null);

  function sincronizar() {
    setRes(null);
    startTransition(async () => {
      setRes(await syncClickUpStatusAction(urlKey));
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sincronizar}
        disabled={pending}
        className="rounded-full border border-fysi-line bg-white text-sm font-medium text-fysi-deep px-4 py-2 hover:border-fysi-deep/40 hover:bg-fysi-cream/40 transition disabled:opacity-50"
      >
        {pending ? "Sincronizando…" : "↻ Sincronizar do ClickUp"}
      </button>

      {res?.erro ? (
        <span className="text-xs text-red-600 max-w-xs text-right">
          {res.erro}
        </span>
      ) : null}

      {res?.ok ? (
        res.atualizados.length === 0 &&
        res.criados.length === 0 &&
        res.vinculados.length === 0 &&
        res.naoCriados.length === 0 ? (
          <span className="text-xs text-fysi-muted">
            Tudo em dia ({res.jaEmDia} projetos conferidos).
          </span>
        ) : (
          <div className="rounded-[12px] border border-fysi-mint-vivid/40 bg-fysi-mint/20 px-3 py-2 max-w-sm flex flex-col gap-2">
            {res.atualizados.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-fysi-deep mb-1">
                  {res.atualizados.length} projeto
                  {res.atualizados.length === 1 ? "" : "s"} atualizado
                  {res.atualizados.length === 1 ? "" : "s"}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {res.atualizados.map((a) => (
                    <li key={a.projeto} className="text-[0.7rem] text-fysi-deep">
                      <strong>{a.projeto}</strong>: {a.de} → {a.para}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {res.criados.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-fysi-deep mb-1">
                  {res.criados.length} projeto
                  {res.criados.length === 1 ? "" : "s"} criado
                  {res.criados.length === 1 ? "" : "s"} — só existia
                  {res.criados.length === 1 ? "" : "m"} no ClickUp
                </p>
                <ul className="flex flex-col gap-0.5">
                  {res.criados.map((c) => (
                    <li key={c.projeto} className="text-[0.7rem] text-fysi-deep">
                      <strong>{c.projeto}</strong>: {c.status}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {res.vinculados.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-fysi-deep mb-1">
                  {res.vinculados.length} já existia
                  {res.vinculados.length === 1 ? "" : "m"} aqui e agora
                  {res.vinculados.length === 1 ? " está ligado" : " estão ligados"} ao
                  ClickUp
                </p>
                <ul className="flex flex-col gap-0.5">
                  {res.vinculados.map((v) => (
                    <li key={v.projeto} className="text-[0.7rem] text-fysi-deep">
                      <strong>{v.projeto}</strong>: {v.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Precisam de gente: o nome não deu pra decidir sozinho. */}
            {res.naoCriados.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-fysi-deep mb-1">
                  {res.naoCriados.length} não entrou —{" "}
                  {res.naoCriados.length === 1 ? "confira" : "confira"} na mão
                </p>
                <ul className="flex flex-col gap-0.5">
                  {res.naoCriados.map((n) => (
                    <li key={n.projeto} className="text-[0.7rem] text-fysi-muted">
                      <strong>{n.projeto}</strong>: {n.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
