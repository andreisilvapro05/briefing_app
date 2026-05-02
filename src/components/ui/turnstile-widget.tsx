"use client";

import { useEffect, useId, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "invisible";
          appearance?: "always" | "execute" | "interaction-only";
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
}

/**
 * Widget Cloudflare Turnstile (modo invisível).
 *
 * Carrega o script da Cloudflare uma vez e renderiza o widget.
 * Quando a verificação passa, chama onToken com o token JWT que o backend
 * vai validar via /turnstile/v0/siteverify.
 */
export function TurnstileWidget({
  siteKey,
  onToken,
  onExpire,
}: TurnstileWidgetProps) {
  const containerId = useId().replace(/:/g, "_");
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    function tryRender() {
      if (!window.turnstile) return;
      const el = document.getElementById(containerId);
      if (!el) return;
      // Evita render duplicado em hot-reload
      if (widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(el, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": onExpire,
        "error-callback": () => {
          // Em caso de erro do CDN, o submit ainda passa pelo honeypot.
        },
        appearance: "interaction-only",
        size: "invisible",
        theme: "auto",
      });
    }

    // Se o script já carregou, renderiza imediatamente.
    tryRender();
    // Caso contrário, fica escutando.
    const interval = setInterval(() => {
      if (window.turnstile && !widgetIdRef.current) tryRender();
      if (widgetIdRef.current) clearInterval(interval);
    }, 200);

    return () => {
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Best-effort
        }
        widgetIdRef.current = null;
      }
    };
  }, [containerId, siteKey, onToken, onExpire]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
      <div id={containerId} aria-hidden="true" />
    </>
  );
}
