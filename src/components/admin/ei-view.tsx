"use client";

import { useState } from "react";
import { EIDocument } from "./ei-document";
import { EIEditor } from "./ei-editor";
import type { EIData } from "@/lib/ei-template";

/**
 * Aba "EI · Estrutura Inicial": abre como DOCUMENTO (leitura) por padrão, com
 * "Editar" pra ir ao formulário. Documento é o que a equipe usa pra produzir.
 */
export function EIView(props: {
  clientId: string;
  clientName: string | null;
  empresa: string | null;
  urlKey: string | null;
  initial: EIData | null;
  atualizadoAt: string | null;
  fallbackDrive?: string | null;
}) {
  const [mode, setMode] = useState<"doc" | "edit">("doc");

  const tab = (active: boolean) =>
    active
      ? "px-4 py-1.5 rounded-full bg-fysi-deep text-fysi-cream font-medium"
      : "px-4 py-1.5 rounded-full text-fysi-muted hover:text-fysi-deep";

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex self-start rounded-full border border-fysi-line bg-white p-0.5 text-sm">
        <button type="button" onClick={() => setMode("doc")} className={tab(mode === "doc")}>
          Documento
        </button>
        <button type="button" onClick={() => setMode("edit")} className={tab(mode === "edit")}>
          Editar
        </button>
      </div>

      {mode === "doc" ? (
        <EIDocument
          data={props.initial}
          clientName={props.clientName}
          empresa={props.empresa}
          atualizadoAt={props.atualizadoAt}
          fallbackDrive={props.fallbackDrive}
        />
      ) : (
        <EIEditor
          clientId={props.clientId}
          clientName={props.clientName}
          empresa={props.empresa}
          urlKey={props.urlKey}
          initial={props.initial}
          atualizadoAt={props.atualizadoAt}
        />
      )}
    </div>
  );
}
