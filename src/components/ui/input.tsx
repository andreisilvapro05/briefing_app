"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    optional,
    leadingIcon,
    trailingIcon,
    className,
    id,
    ...rest
  },
  ref
) {
  const inputId = id ?? rest.name;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="flex items-baseline justify-between text-sm font-medium text-fysi-deep"
        >
          <span>{label}</span>
          {optional ? (
            <span className="text-xs font-normal text-fysi-muted">
              opcional
            </span>
          ) : null}
        </label>
      ) : null}

      <div
        className={cn(
          "group relative flex h-12 items-center gap-3 rounded-[12px] border bg-white px-4 transition",
          "focus-within:border-fysi-green/40 focus-within:shadow-[0_0_0_4px_rgba(141,226,197,0.25)]",
          error
            ? "border-red-300 focus-within:border-red-400 focus-within:shadow-[0_0_0_4px_rgba(252,165,165,0.25)]"
            : "border-fysi-line hover:border-fysi-line-strong"
        )}
      >
        {leadingIcon ? (
          <span className="text-fysi-muted shrink-0">{leadingIcon}</span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            "h-full w-full bg-transparent text-[0.95rem] text-fysi-deep placeholder:text-fysi-muted/70",
            "outline-none border-0 focus:ring-0",
            className
          )}
          {...rest}
        />
        {trailingIcon ? (
          <span className="text-fysi-muted shrink-0">{trailingIcon}</span>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-fysi-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
