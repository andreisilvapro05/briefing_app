"use client";

import type { PartialBlock } from "@blocknote/core";
import { EIBlockEditor } from "./ei-block-editor";

/**
 * Aba "EI · Estrutura Inicial" do hub: editor de blocos estilo Notion/
 * ClickUp — a mesma instância serve leitura e escrita, sem toggle
 * "Documento"/"Editar" (não faz mais sentido nesse formato).
 */
export function EIView(props: {
  docId: string;
  urlKey: string | null;
  initialBlocks: PartialBlock[];
  atualizadoAt: string | null;
}) {
  return (
    <EIBlockEditor
      docId={props.docId}
      urlKey={props.urlKey}
      initialBlocks={props.initialBlocks}
      atualizadoAt={props.atualizadoAt}
    />
  );
}
