"use client";

import { useState, useTransition } from "react";
import {
  diagnosticarClickUpAction,
  syncClickUpStatusAction,
  type SyncResultado,
} from "@/app/admin/lista/actions";
import type { DiagnosticoClickUp } from "@/lib/clickup";

/**
 * "Sincronizar do ClickUp" — puxa o status atual de cada projeto.
 * Mostra o que mudou, em vez de só dizer "pronto": saber QUAIS projetos
 * andaram é metade do valor da sincronização.
 */
export function ClickUpSyncButton({ urlKey }: { urlKey: string | null }) {
  const [pending, startTransition] = useTransition();
  const [res, setRes] = useState<SyncResultado | null>(null);
  /**
   * O resultado do teste de ponte. Separado do sync porque responde outra
   * pergunta: o sync diz o que MUDOU, o teste diz se a ponte FUNCIONA —
   * e "tudo em dia" parece sucesso mesmo quando a escrita está quebrada.
   */
  const [diag, setDiag] = useState<
    DiagnosticoClickUp | { erro: string } | null
  >(null);

  function sincronizar() {
    setRes(null);
    setDiag(null);
    startTransition(async () => {
      setRes(await syncClickUpStatusAction(urlKey));
    });
  }

  function testar() {
    setRes(null);
    setDiag(null);
    startTransition(async () => {
      setDiag(await diagnosticarClickUpAction(urlKey));
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

      <button
        type="button"
        onClick={testar}
        disabled={pending}
        className="text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2 disabled:opacity-50"
      >
        Testar conexão com o ClickUp
      </button>

      {diag ? <Diagnostico d={diag} /> : null}

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

/**
 * O resultado do teste de ponte, em linguagem de gente.
 *
 * A linha que mais importa é a última: os nomes de status que a lista do
 * ClickUp aceita. O app escreve "completo| entregue"; se lá estiver
 * "Completo | Entregue", a escrita leva 400 e nada acontece — e essa
 * diferença é invisível de qualquer outro lugar.
 */
function Diagnostico({ d }: { d: DiagnosticoClickUp | { erro: string } }) {
  if ("erro" in d) {
    return (
      <span className="text-xs text-red-600 max-w-sm text-right">{d.erro}</span>
    );
  }

  const linhas: { ok: boolean; texto: string }[] = [
    { ok: d.temToken, texto: d.temToken ? "Token configurado" : "SEM token no Vercel" },
    {
      ok: d.leituraOk,
      texto: d.leituraOk
        ? `Leitura funciona (${d.projetosLidos} projetos)`
        : `Leitura falhou: ${d.leituraErro ?? "motivo desconhecido"}`,
    },
    {
      ok: d.escritaOk,
      texto: d.escritaOk
        ? `Escrita funciona (testada em "${d.escritaEm}")`
        : `Escrita falhou: ${d.escritaErro ?? "motivo desconhecido"}`,
    },
  ];

  return (
    <div className="rounded-[12px] border border-fysi-line bg-white px-3 py-2 max-w-sm flex flex-col gap-1 text-left">
      <p className="text-xs font-semibold text-fysi-deep">
        Ponte com o ClickUp
      </p>
      {linhas.map((l) => (
        <p
          key={l.texto}
          className={`text-[0.7rem] ${l.ok ? "text-fysi-deep" : "text-red-700"}`}
        >
          {l.ok ? "✓" : "✗"} {l.texto}
        </p>
      ))}

      {d.statusQueNaoExistem && d.statusQueNaoExistem.length > 0 ? (
        <p className="text-[0.7rem] text-amber-800 border-t border-fysi-line pt-1 mt-1">
          O app tenta escrever{" "}
          <strong>{d.statusQueNaoExistem.join(", ")}</strong>, e essa lista do
          ClickUp não tem esse nome. É a causa mais provável.
        </p>
      ) : null}

      {d.statusDaLista && d.statusDaLista.length > 0 ? (
        <details className="text-[0.7rem] text-fysi-muted">
          <summary className="cursor-pointer">
            Nomes que o ClickUp aceita nessa lista
          </summary>
          <p className="mt-1">{d.statusDaLista.join(" · ")}</p>
        </details>
      ) : null}
    </div>
  );
}
