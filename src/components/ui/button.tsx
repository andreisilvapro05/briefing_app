"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "accent" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition " +
  "disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px " +
  "select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  // Primário — fundo verde profundo sobre cream. Uso padrão.
  primary:
    "bg-fysi-deep text-fysi-cream hover:bg-fysi-deep/90 " +
    "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(4,43,48,0.4)]",
  // Secundário — outline em verde profundo.
  secondary:
    "bg-transparent text-fysi-deep border border-fysi-deep/15 " +
    "hover:bg-fysi-deep/[0.03] hover:border-fysi-deep/25",
  // Acento — amarelo Fysi. Uso pontual: envio final, próxima etapa.
  accent:
    "bg-fysi-yellow text-fysi-deep uppercase tracking-[0.08em] text-sm " +
    "hover:brightness-95",
  // Ghost — sem fundo, sem borda. Para ações terciárias.
  ghost:
    "bg-transparent text-fysi-deep/70 hover:text-fysi-deep hover:bg-fysi-deep/[0.04]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[0.95rem]",
  lg: "h-14 px-8 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    leadingIcon,
    trailingIcon,
    fullWidth,
    className,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
    </button>
  );
});
