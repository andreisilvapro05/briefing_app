import type { ReactNode } from "react";
import { FysiWordmark } from "@/components/brand/fysi-mark";
import { cn } from "@/lib/cn";

interface ShellProps {
  children: ReactNode;
  // Metadata mostrada nas extremidades do header — referência ao manual
  // (esquerda: contexto · direita: ano/seção).
  contextLabel?: string;
  sectionLabel?: string;
  tone?: "cream" | "aurora" | "deep";
  hideHeader?: boolean;
}

const tones = {
  cream: "bg-fysi-cream text-fysi-deep",
  aurora: "fysi-aurora text-fysi-deep",
  deep: "fysi-aurora-dark text-fysi-cream",
};

export function Shell({
  children,
  contextLabel = "Briefing",
  sectionLabel,
  tone = "cream",
  hideHeader,
}: ShellProps) {
  const isDark = tone === "deep";

  return (
    <div className={cn("min-h-screen flex flex-col", tones[tone])}>
      {!hideHeader ? (
        <header
          className={cn(
            "flex items-center justify-between px-6 md:px-10 py-6 border-b",
            isDark ? "border-white/10" : "border-fysi-deep/8"
          )}
        >
          <div className="flex items-center gap-6">
            <FysiWordmark className={isDark ? "text-fysi-cream" : ""} />
            {contextLabel ? (
              <span
                className={cn(
                  "hidden sm:inline-block text-[0.7rem] uppercase tracking-[0.14em] font-medium",
                  isDark ? "text-fysi-mint/70" : "text-fysi-muted"
                )}
              >
                · {contextLabel}
              </span>
            ) : null}
          </div>

          {sectionLabel ? (
            <span
              className={cn(
                "text-[0.7rem] uppercase tracking-[0.14em] font-medium",
                isDark ? "text-fysi-mint/70" : "text-fysi-muted"
              )}
            >
              {sectionLabel}
            </span>
          ) : null}
        </header>
      ) : null}

      <main className="flex-1 flex flex-col">{children}</main>

      <footer
        className={cn(
          "px-6 md:px-10 py-6 text-[0.7rem] uppercase tracking-[0.14em] font-medium border-t",
          isDark
            ? "border-white/10 text-fysi-mint/60"
            : "border-fysi-deep/8 text-fysi-muted"
        )}
      >
        <div className="flex items-center justify-between">
          <span>© Fysi Lab · Sistema estruturado de conversão</span>
          <span className="hidden md:inline">v0.1 · M1</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Container central padrão para conteúdo principal das telas.
 */
export function ContentFrame({
  children,
  className,
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const widths = {
    sm: "max-w-xl",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  return (
    <div
      className={cn(
        "mx-auto w-full px-6 md:px-10 py-12 md:py-20",
        widths[size],
        className
      )}
    >
      {children}
    </div>
  );
}
