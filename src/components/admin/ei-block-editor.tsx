"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { Button } from "@/components/ui/button";
import { updateEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";

/**
 * Editor de blocos da EI (Estrutura Inicial) — estilo Notion/ClickUp.
 * Substitui o formulário de campos fixos que existia antes: uma única
 * instância de editor serve leitura e escrita, sem toggle "Documento"/
 * "Editar". Tema Fysi aplicado via variáveis CSS do BlockNote (--bn-*),
 * não a prop `theme` (essa é só do shell @blocknote/mantine — o shell
 * shadcn usado aqui não a aceita).
 */

const FYSI_BN_VARS = {
  "--bn-colors-editor-text": "#042B30",
  "--bn-colors-editor-background": "#ffffff",
  "--bn-colors-menu-text": "#042B30",
  "--bn-colors-menu-background": "#ffffff",
  "--bn-colors-tooltip-text": "#F7F6F4",
  "--bn-colors-tooltip-background": "#042B30",
  "--bn-colors-hovered-text": "#042B30",
  "--bn-colors-hovered-background": "#F7F6F4",
  "--bn-colors-selected-text": "#042B30",
  "--bn-colors-selected-background": "#BFEDE0",
  "--bn-colors-disabled-text": "#6B7472",
  "--bn-colors-disabled-background": "#F7F6F4",
  "--bn-colors-shadow": "#E5E5E0",
  "--bn-colors-border": "#E5E5E0",
  "--bn-colors-side-menu": "#6B7472",
  "--bn-border-radius": "10px",
} as React.CSSProperties;

export interface EIBlockEditorProps {
  docId: string;
  urlKey: string | null;
  initialBlocks: PartialBlock[] | null;
  atualizadoAt: string | null;
}

export function EIBlockEditor({
  docId,
  urlKey,
  initialBlocks,
  atualizadoAt,
}: EIBlockEditorProps) {
  const editor = useCreateBlockNote({
    initialContent:
      initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined,
  });

  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(atualizadoAt);
  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    const fd = new FormData();
    fd.append("docId", docId);
    if (urlKey) fd.append("key", urlKey);
    fd.append("eiJson", JSON.stringify({ blocks: editor.document }));
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateEIDocumentAction(fd);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : "Erro ao salvar. Tente de novo em alguns segundos."
        );
      }
    });
  }

  async function copyMarkdown() {
    const markdown = await editor.blocksToMarkdownLossy(editor.document);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(markdown);
    }
  }

  // Autosave debounced 800ms após a última edição — mesmo padrão do
  // formulário de campos fixos que este componente substitui. Ignora o
  // disparo inicial do onChange no mount (o próprio BlockNote dispara um
  // onChange ao montar mesmo sem edição do usuário).
  const hasMountedRef = useRef(false);
  useEffect(() => {
    return editor.onChange(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      const timeout = setTimeout(save, 800);
      return () => clearTimeout(timeout);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div
      className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6"
      style={FYSI_BN_VARS}
    >
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <p className="text-xs text-fysi-muted">
          {savedAt ? (
            <span>Salvo em {new Date(savedAt).toLocaleString("pt-BR")}</span>
          ) : (
            <span className="text-amber-700">Nunca salvo</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={copyMarkdown}>
            Copiar MD
          </Button>
          {pending ? (
            <span className="text-xs text-fysi-muted px-2">Salvando…</span>
          ) : null}
        </div>
      </div>
      {saveError ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mb-3 inline-block">
          ⚠ {saveError}
        </p>
      ) : null}
      <BlockNoteView editor={editor} />
    </div>
  );
}
