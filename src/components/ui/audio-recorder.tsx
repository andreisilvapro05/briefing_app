"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface AudioRecorderProps {
  onTranscribed: (text: string) => void;
  onTranscribingChange?: (transcribing: boolean) => void;
  disabled?: boolean;
  // Limites do PRD: mín 5s, máx 5min
  minSeconds?: number;
  maxSeconds?: number;
}

/**
 * Captura áudio via MediaRecorder, envia para /api/transcribe
 * e devolve o texto transcrito ao componente pai.
 */
export function AudioRecorder({
  onTranscribed,
  onTranscribingChange,
  disabled,
  minSeconds = 5,
  maxSeconds = 300,
}: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener("stop", () => {
        // Liberar microfone
        stream.getTracks().forEach((t) => t.stop());
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      });

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= maxSeconds) {
            stop();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? "Não foi possível acessar o microfone."
          : "Erro ao iniciar gravação."
      );
    }
  }

  async function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "inactive") return;

    setRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (seconds < minSeconds) {
      recorder.stop();
      setError(`Gravação muito curta (mín. ${minSeconds}s).`);
      return;
    }

    // Quando o stop for processado, fazemos o upload
    recorder.addEventListener(
      "stop",
      async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await transcribe(blob);
      },
      { once: true }
    );

    recorder.stop();
  }

  async function transcribe(blob: Blob) {
    onTranscribingChange?.(true);
    try {
      const formData = new FormData();
      const ext = inferExt(blob.type);
      formData.append("audio", blob, `recording.${ext}`);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Falha ao transcrever áudio.");
      }

      const data = (await res.json()) as { text: string };
      onTranscribed(data.text);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao transcrever áudio."
      );
    } finally {
      onTranscribingChange?.(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-[0.7rem] text-red-600 mr-2">{error}</span>
      ) : null}

      {recording ? (
        <span className="flex items-center gap-2 text-[0.75rem] text-fysi-deep font-medium">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-fysi-mint-vivid animate-pulse"
          />
          {formatTime(seconds)} / {formatTime(maxSeconds)}
        </span>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={recording ? stop : start}
        aria-label={recording ? "Parar gravação" : "Gravar áudio"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
          "uppercase tracking-[0.08em]",
          recording
            ? "bg-fysi-deep text-fysi-cream hover:bg-fysi-deep/90"
            : "bg-fysi-mint text-fysi-deep hover:bg-fysi-mint-vivid",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {recording ? (
          // Quadradinho de "stop"
          <svg
            aria-hidden
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
          >
            <rect x="1" y="1" width="8" height="8" rx="1.5" />
          </svg>
        ) : (
          // Microfone (minimalista, stroke fino — coerente com a marca)
          <svg
            aria-hidden
            width="11"
            height="13"
            viewBox="0 0 11 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="0.75" width="4" height="7" rx="2" />
            <path d="M1.25 6.5a4.25 4.25 0 0 0 8.5 0" />
            <path d="M5.5 10.75v1.5" />
          </svg>
        )}
        {recording ? "Parar" : "Gravar"}
      </button>
    </div>
  );
}

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

function inferExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function formatTime(s: number) {
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
