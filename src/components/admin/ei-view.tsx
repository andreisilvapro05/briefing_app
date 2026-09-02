"use client";

import dynamic from "next/dynamic";
import type { PartialBlock } from "@blocknote/core";

/**
 * Aba "EI · Estrutura Inicial" do hub: editor de blocos estilo Notion/
 * ClickUp — a mesma instância serve leitura e escrita.
 *
 * O editor (BlockNote) é carregado com ssr:false — ele é client-only e
 * renderizar no servidor disparava um 500/erro de hidratação na página do
 * documento (a página ainda aparecia, mas a resposta vinha 500). Com
 * ssr:false o servidor manda só o esqueleto e o editor monta no cliente.
 */
const EIBlockEditor = dynamic(
  () => import("./ei-block-editor").then((m) => m.EIBlockEditor),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
        <div className="h-4 w-40 bg-fysi-cream rounded mb-4 animate-pulse" />
        <div className="h-64 bg-fysi-cream/60 rounded animate-pulse" />
      </div>
    ),
  }
);

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
