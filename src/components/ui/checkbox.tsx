"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, description, className, id, ...rest }, ref) {
    const fieldId = id ?? rest.name;
    return (
      <label
        htmlFor={fieldId}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-[14px] border border-fysi-line bg-white px-4 py-3 transition",
          "hover:border-fysi-deep/30",
          rest.checked && "border-fysi-deep/40 bg-fysi-mint/40",
          rest.disabled && "cursor-not-allowed opacity-60",
          className
        )}
      >
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-fysi-line-strong text-fysi-deep focus:ring-fysi-mint-vivid"
          {...rest}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-fysi-deep">{label}</span>
          {description ? (
            <span className="text-xs text-fysi-muted">{description}</span>
          ) : null}
        </span>
      </label>
    );
  }
);
