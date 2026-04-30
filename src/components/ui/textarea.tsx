"use client";

import { forwardRef, useState, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { AudioRecorder } from "./audio-recorder";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  // Mostra botão "gravar áudio" que transcreve para o textarea (regra do PRD).
  audioTranscribe?: boolean;
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      hint,
      error,
      optional,
      audioTranscribe,
      className,
      id,
      rows = 5,
      onChange,
      value,
      ...rest
    },
    ref
  ) {
    const fieldId = id ?? rest.name;
    const [transcribing, setTranscribing] = useState(false);

    function appendTranscript(text: string) {
      if (!onChange) return;
      const current = typeof value === "string" ? value : "";
      const next = current ? `${current}\n\n${text}` : text;
      const fakeEvent = {
        target: { value: next },
        currentTarget: { value: next },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(fakeEvent);
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <div className="flex items-baseline justify-between">
            <label
              htmlFor={fieldId}
              className="text-sm font-medium text-fysi-deep"
            >
              {label}
            </label>
            {optional ? (
              <span className="text-xs font-normal text-fysi-muted">
                opcional
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-[12px] border bg-white transition",
            "focus-within:border-fysi-green/40 focus-within:shadow-[0_0_0_4px_rgba(141,226,197,0.25)]",
            error
              ? "border-red-300"
              : "border-fysi-line hover:border-fysi-line-strong"
          )}
        >
          <textarea
            ref={ref}
            id={fieldId}
            rows={rows}
            value={value}
            onChange={onChange}
            aria-invalid={!!error}
            className={cn(
              "block w-full resize-y bg-transparent px-4 py-3 text-[0.95rem] text-fysi-deep",
              "placeholder:text-fysi-muted/70 outline-none border-0 focus:ring-0",
              className
            )}
            {...rest}
          />

          {audioTranscribe ? (
            <div className="flex items-center justify-between gap-3 border-t border-fysi-line px-3 py-2">
              <span className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
                {transcribing
                  ? "Transcrevendo…"
                  : "Prefere falar? Grave um áudio."}
              </span>
              <AudioRecorder
                disabled={transcribing}
                onTranscribed={appendTranscript}
                onTranscribingChange={setTranscribing}
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : hint ? (
          <p className="text-xs text-fysi-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);
