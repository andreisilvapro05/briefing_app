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
 *
 * As variáveis --bn-* ficam em `:root` (globals.css), NÃO como style
 * inline num wrapper aqui — os menus flutuantes do BlockNote (cores,
 * formatação, slash-command) renderizam via portal direto em
 * document.body, fora da árvore desse wrapper, e não herdavam a
 * variável de um ancestral que não é ancestral real deles (o menu de
 * cores quebrava visualmente por causa disso).
 */

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
    <div className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <p className="text-xs text-fysi-muted">
          {savedAt ? (
            <span>
              Salvo em{" "}
              {new Date(savedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </span>
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
