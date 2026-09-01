"use client";

import { useEffect, useRef } from "react";

/**
 * Prende o foco do teclado dentro de um modal enquanto `active` — Tab/Shift+Tab
 * circulam só entre os elementos focáveis de dentro, foca o primeiro ao abrir,
 * e devolve o foco pra onde estava ao fechar. Acessibilidade básica de dialog
 * (junto com role="dialog"/aria-modal e o Escape que cada modal já trata).
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const prevFocus = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );

    // Se nada dentro já tem foco, foca o primeiro focável.
    if (!node.contains(document.activeElement)) {
      focusables()[0]?.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      // Devolve o foco pro gatilho, se ainda existir no DOM.
      if (prevFocus && document.body.contains(prevFocus)) prevFocus.focus();
    };
  }, [active]);
  return ref;
}
