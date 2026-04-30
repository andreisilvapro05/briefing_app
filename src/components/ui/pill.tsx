import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "mint" | "deep" | "outline" | "yellow" | "muted";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  mint: "bg-fysi-mint text-fysi-deep",
  deep: "bg-fysi-deep text-fysi-cream",
  outline: "bg-transparent text-fysi-deep border border-fysi-deep/15",
  yellow: "bg-fysi-yellow text-fysi-deep",
  muted: "bg-fysi-deep/[0.05] text-fysi-muted",
};

export function Pill({
  tone = "mint",
  className,
  children,
  ...rest
}: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-tight",
        tones[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Eyebrow({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "text-[0.7rem] uppercase tracking-[0.14em] text-fysi-muted font-medium",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
