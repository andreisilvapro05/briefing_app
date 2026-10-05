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
 * "Editar". Tema Fysi aplicado via variáveis CSS do BlockNote (--bn-*).
 *
 * ⚠️ `theme="light"` é OBRIGATÓRIO e não é preferência estética.
 *
 * Sem a prop, o `@blocknote/react` chama `usePrefersColorScheme()`, lê
 * `(prefers-color-scheme: dark)` do SISTEMA e põe `data-color-scheme="dark"`
 * na raiz do editor. Como este app não tem modo escuro nenhum (tudo é
 * creme e branco), quem usa o computador no escuro via o documento PRETO
 * dentro de um card branco. Karine (04/10): "o layout do briefing está
 * preto, ruim".
 *
 * Um comentário antigo aqui afirmava que o shell shadcn não aceita
 * `theme` — está errado: `@blocknote/shadcn` reexporta
 * `React.ComponentProps<typeof BlockNoteViewRaw>`, que inclui
 * `theme?: "light" | "dark"`. Foi essa afirmação errada que deixou o bug
 * de pé.
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

  /**
   * Autosave 800ms depois da ÚLTIMA tecla.
   *
   * ⚠️ O código anterior não tinha debounce nenhum, apesar do comentário
   * dizer que tinha. O `clearTimeout` estava no retorno do callback do
   * `editor.onChange`, e o BlockNote IGNORA o que esse callback devolve —
   * só o retorno do `onChange` em si (a função de desinscrição) é usado.
   * Resultado: cada tecla agendava o próprio `save()`, disparando N Server
   * Actions concorrentes. Como a ordem de chegada não é garantida, uma
   * resposta atrasada podia gravar um documento MAIS ANTIGO por cima do
   * mais novo — perda de texto silenciosa.
   *
   * Agora o timer é único (useRef): cada mudança cancela o anterior.
   */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);
  const saveRef = useRef(save);
  /**
   * `save` fecha sobre estado e muda a cada render; o efeito de baixo roda
   * uma vez só (depende de `editor`), então ele precisa alcançar a versão
   * atual. A escrita vai num efeito, não no corpo do componente: o lint do
   * React Compiler proíbe tocar em ref durante o render.
   */
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const desinscrever = editor.onChange(() => {
      // O BlockNote dispara um onChange ao montar, sem edição do usuário.
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        saveRef.current();
      }, 800);
    });

    return () => {
      /**
       * Salva o que estiver pendente ANTES de desmontar.
       *
       * Sem isto, quem digitava e clicava na lateral dentro de 800ms
       * perdia o que escreveu — e a tela ainda mostrava "Salvo em <data
       * antiga>", sem avisar nada.
       */
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        saveRef.current();
      }
      desinscrever?.();
    };
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
          {saveError}
        </p>
      ) : null}
      {/* `fysi-doc` dá ao documento a hierarquia que o ClickUp tinha com
          cor — faixa no título de seção, rótulo em negrito destacado. Ver
          globals.css; vale no editor e na página pública, pros dois lerem
          igual. */}
      <div className="fysi-doc">
        <BlockNoteView editor={editor} theme="light" />
      </div>
    </div>
  );
}
