"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  layout?: "stack" | "pills" | "scale";
  // Para layout "scale" (3 pontos), labels nas extremidades.
  scaleLabels?: { left: string; center?: string; right: string };
  legend?: string;
  description?: string;
  error?: string;
  className?: string;
}

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  layout = "stack",
  scaleLabels,
  legend,
  description,
  error,
  className,
}: RadioGroupProps) {
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      {legend ? (
        <legend className="text-sm font-medium text-fysi-deep">
          {legend}
        </legend>
      ) : null}
      {description ? (
        <p className="text-xs text-fysi-muted -mt-1">{description}</p>
      ) : null}

      {layout === "stack" ? (
        <div className="flex flex-col gap-2 mt-1">
          {options.map((opt) => (
            <RadioStackOption
              key={opt.value}
              name={name}
              option={opt}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
          ))}
        </div>
      ) : layout === "pills" ? (
        <div className="flex flex-wrap gap-2 mt-1">
          {options.map((opt) => (
            <RadioPillOption
              key={opt.value}
              name={name}
              option={opt}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
          ))}
        </div>
      ) : (
        <ScaleLayout
          options={options}
          name={name}
          value={value}
          onChange={onChange}
          labels={scaleLabels}
        />
      )}

      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
    </fieldset>
  );
}

function RadioStackOption({
  option,
  name,
  checked,
  onChange,
}: {
  option: RadioOption;
  name: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[14px] border bg-white px-4 py-3 transition",
        checked
          ? "border-fysi-deep/40 bg-fysi-mint/40"
          : "border-fysi-line hover:border-fysi-deep/30"
      )}
    >
      <input
        type="radio"
        name={name}
        value={option.value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 border-fysi-line-strong text-fysi-deep focus:ring-fysi-mint-vivid"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-fysi-deep">
          {option.label}
        </span>
        {option.description ? (
          <span className="text-xs text-fysi-muted">{option.description}</span>
        ) : null}
      </span>
    </label>
  );
}

function RadioPillOption({
  option,
  name,
  checked,
  onChange,
}: {
  option: RadioOption;
  name: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition",
        checked
          ? "bg-fysi-deep text-fysi-cream border-fysi-deep"
          : "bg-white text-fysi-deep border-fysi-line hover:border-fysi-deep/30"
      )}
    >
      <input
        type="radio"
        name={name}
        value={option.value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {option.label}
    </label>
  );
}

/**
 * Layout em escala de 3 pontos — usado no Bloco 3 (Linguagem e tom).
 * Mostra labels nas extremidades e os pontos selecionáveis no meio.
 */
function ScaleLayout({
  options,
  name,
  value,
  onChange,
  labels,
}: {
  options: RadioOption[];
  name: string;
  value: string;
  onChange: (v: string) => void;
  labels?: { left: string; center?: string; right: string };
}) {
  return (
    <div className="mt-2 rounded-[16px] border border-fysi-line bg-white p-4">
      <div className="grid grid-cols-3 gap-2 text-center text-xs text-fysi-muted">
        <span className="text-left font-medium">
          {labels?.left ?? options[0]?.label}
        </span>
        <span className="font-medium">
          {labels?.center ?? options[1]?.label ?? "Meio termo"}
        </span>
        <span className="text-right font-medium">
          {labels?.right ?? options[options.length - 1]?.label}
        </span>
      </div>

      <div
        role="radiogroup"
        className="mt-3 flex items-center justify-between"
      >
        {options.map((opt, idx) => {
          const isSelected = value === opt.value;
          const position =
            idx === 0
              ? "items-start"
              : idx === options.length - 1
                ? "items-end"
                : "items-center";
          return (
            <label
              key={opt.value}
              className={cn(
                "group flex flex-col gap-1 cursor-pointer flex-1",
                position
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition",
                  isSelected
                    ? "bg-fysi-deep border-fysi-deep scale-110"
                    : "border-fysi-line-strong group-hover:border-fysi-deep/40"
                )}
              />
              <span className="sr-only">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface RadioCardOption {
  value: string;
  title: string;
  description?: string;
}

export function RadioCardGroup({
  name,
  options,
  value,
  onChange,
  className,
}: {
  name: string;
  options: RadioCardOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn("grid sm:grid-cols-2 gap-3", className)}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "cursor-pointer rounded-[16px] border bg-white p-4 transition",
              isSelected
                ? "border-fysi-deep bg-fysi-deep text-fysi-cream"
                : "border-fysi-line hover:border-fysi-deep/30"
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={isSelected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span className="block text-sm font-medium">
              {opt.title}
            </span>
            {opt.description ? (
              <span
                className={cn(
                  "block mt-1 text-xs leading-relaxed",
                  isSelected ? "text-fysi-mint/80" : "text-fysi-muted"
                )}
              >
                {opt.description}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function RadioGroupRoot({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
