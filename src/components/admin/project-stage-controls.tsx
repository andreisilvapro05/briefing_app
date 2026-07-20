"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setStageAction,
  toggleChamadaFeitaAction,
  toggleBriefingConcluidoAction,
  setCopyReviewLinkAction,
} from "@/app/admin/[id]/actions";

/**
 * Controles de andamento do projeto (admin) — reorganizado e instantâneo.
 *
 * - Selecionar etapa: clica direto na etapa → salva na hora + "Salvo ✓".
 * - Marcadores (chamada feita / briefing concluído): toggles instantâneos.
 * - Link de revisão da copy: campo + salvar.
 *
 * Tudo reflete no painel do cliente (ele vê ao recarregar).
 */

interface Etapa {
  titulo: string;
}

export function ProjectStageControls({
  clientId,
  urlKey,
  etapas,
  currentStage,
  chamadaFeita,
  briefingConcluido,
  copyReviewLink,
}: {
  clientId: string;
  urlKey?: string;
  etapas: Etapa[];
  currentStage: number;
  chamadaFeita: boolean;
  briefingConcluido: boolean;
  copyReviewLink: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [chamada, setChamada] = useState(chamadaFeita);
  const [briefing, setBriefing] = useState(briefingConcluido);
  const [copyLink, setCopyLink] = useState(copyReviewLink);
  const [copyLinkDirty, setCopyLinkDirty] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function baseFd() {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    return fd;
  }

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash((f) => (f === msg ? null : f)), 1800);
  }

  function selectStage(idx: number) {
    if (idx === stage || pending) return;
    setStage(idx); // otimista
    const fd = baseFd();
    fd.append("target", String(idx));
    startTransition(async () => {
      await setStageAction(fd);
      showFlash("Etapa salva ✓");
      router.refresh();
    });
  }

  function move(direction: "prev" | "next") {
    const next =
      direction === "next"
        ? Math.min(etapas.length - 1, stage + 1)
        : Math.max(0, stage - 1);
    selectStage(next);
  }

  function toggleChamada() {
    if (pending) return;
    setChamada((v) => !v);
    startTransition(async () => {
      await toggleChamadaFeitaAction(baseFd());
      showFlash("Salvo ✓");
      router.refresh();
    });
  }

  function toggleBriefing() {
    if (pending) return;
    setBriefing((v) => !v);
    startTransition(async () => {
      await toggleBriefingConcluidoAction(baseFd());
      showFlash("Salvo ✓");
      router.refresh();
    });
  }

  function saveCopyLink() {
    const fd = baseFd();
    fd.append("copyReviewLink", copyLink.trim());
    startTransition(async () => {
      await setCopyReviewLinkAction(fd);
      setCopyLinkDirty(false);
      showFlash("Link salvo ✓");
      router.refresh();
    });
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
        <span className="text-[0.7rem] uppercase tracking-[0.14em] text-fysi-muted font-semibold">
          Andamento do projeto
        </span>
        <div className="flex items-center gap-3">
          {flash ? (
            <span className="text-xs font-medium text-fysi-green">{flash}</span>
          ) : null}
          {etapas.length > 0 ? (
            <span className="text-xs text-fysi-muted">
              Etapa {stage + 1} de {etapas.length}
            </span>
          ) : null}
        </div>
      </div>

      {etapas.length > 0 ? (
        <>
          <p className="text-sm text-fysi-muted mb-4">
            Clique na etapa pra mover o cliente. Ele vê isso no painel dele.
          </p>

          {/* Seletor de etapas — clicável, salva na hora */}
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
            {etapas.map((etapa, idx) => {
              const isDone = idx < stage;
              const isCurrent = idx === stage;
              return (
                <li key={`${idx}-${etapa.titulo}`}>
                  <button
                    type="button"
                    onClick={() => selectStage(idx)}
                    disabled={pending}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`w-full h-full text-left rounded-[12px] border px-3 py-2.5 transition disabled:cursor-wait ${
                      isCurrent
                        ? "bg-fysi-deep text-fysi-cream border-fysi-deep shadow-sm"
                        : isDone
                          ? "bg-fysi-mint border-fysi-mint-vivid/50 text-fysi-deep hover:brightness-95"
                          : "bg-white border-fysi-line text-fysi-muted hover:border-fysi-deep/40 hover:text-fysi-deep"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-[0.62rem] uppercase tracking-[0.12em] font-semibold opacity-70">
                        Etapa {String(idx + 1).padStart(2, "0")}
                      </span>
                      {isDone ? (
                        <span aria-hidden className="text-[0.7rem]">
                          ✓
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs font-medium leading-tight mt-1">
                      {etapa.titulo}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-fysi-line">
            <button
              type="button"
              onClick={() => move("prev")}
              disabled={pending || stage <= 0}
              className="text-sm text-fysi-muted hover:text-fysi-deep disabled:opacity-30 disabled:hover:text-fysi-muted"
            >
              ← Anterior
            </button>
            <span className="text-sm text-fysi-deep font-medium text-center truncate px-2">
              {etapas[stage]?.titulo ?? "—"}
            </span>
            <button
              type="button"
              onClick={() => move("next")}
              disabled={pending || stage >= etapas.length - 1}
              className="text-sm font-medium text-fysi-deep hover:text-fysi-green disabled:opacity-30"
            >
              Avançar →
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-fysi-muted mb-2">
          Defina o <strong>tipo de projeto</strong> (no topo) pra liberar as
          etapas.
        </p>
      )}

      {/* Marcadores */}
      <div className="mt-6 pt-5 border-t border-fysi-line">
        <p className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold mb-3">
          Marcadores rápidos
        </p>
        <div className="flex flex-wrap gap-2.5">
          <ToggleChip
            active={chamada}
            onClick={toggleChamada}
            disabled={pending}
            label="Chamada feita"
          />
          <ToggleChip
            active={briefing}
            onClick={toggleBriefing}
            disabled={pending}
            label="Briefing concluído"
          />
        </div>
      </div>

      {/* Link de revisão da copy */}
      <div className="mt-6 pt-5 border-t border-fysi-line flex flex-col gap-2">
        <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
          📝 Link de revisão da copy
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={copyLink}
            onChange={(e) => {
              setCopyLink(e.target.value);
              setCopyLinkDirty(true);
            }}
            placeholder="https://docs.google.com/document/..."
            className="flex-1 rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
          />
          <button
            type="button"
            onClick={saveCopyLink}
            disabled={pending || !copyLinkDirty}
            className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90 disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
        <p className="text-[0.65rem] text-fysi-muted">
          Aparece pro cliente na etapa “Criação da copy” da timeline.
        </p>
      </div>
    </section>
  );
}

function ToggleChip({
  active,
  onClick,
  disabled,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-wait ${
        active
          ? "bg-fysi-mint border-fysi-mint-vivid text-fysi-deep"
          : "bg-white border-fysi-line text-fysi-muted hover:border-fysi-deep/40 hover:text-fysi-deep"
      }`}
    >
      <span
        className={`grid place-items-center w-4 h-4 rounded-[5px] border text-[0.6rem] ${
          active
            ? "bg-fysi-deep border-fysi-deep text-fysi-cream"
            : "border-fysi-line-strong text-transparent"
        }`}
        aria-hidden
      >
        ✓
      </span>
      {label}
    </button>
  );
}
