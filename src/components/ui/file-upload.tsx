"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { loadCliente } from "@/lib/storage";

export interface UploadedFile {
  // url retornada pela rota de upload (Supabase Storage)
  url: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

interface FileUploadProps {
  label?: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  bucket?: string;
  // Caminho lógico — usado para organizar uploads por cliente.
  pathPrefix?: string;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  // Em bytes — default 25MB
  maxSize?: number;
}

export function FileUpload({
  label,
  hint,
  accept,
  multiple = true,
  bucket = "briefing-uploads",
  pathPrefix = "",
  value,
  onChange,
  maxFiles = 20,
  maxSize = 25 * 1024 * 1024,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setError(null);

    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      setError(`Máximo de ${maxFiles} arquivos atingido.`);
      return;
    }

    const accepted = Array.from(files).slice(0, remaining);
    const oversized = accepted.find((f) => f.size > maxSize);
    if (oversized) {
      setError(`Arquivo "${oversized.name}" excede o limite de tamanho.`);
      return;
    }

    // Pega o id do cliente atual (criado em /api/auth/start) pra atrelar
    // o upload ao registro mesmo antes do cliente clicar no magic link.
    const cliente = loadCliente();
    const clientId = cliente?.id ?? "";

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        accepted.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("pathPrefix", pathPrefix);
          if (clientId) formData.append("clientId", clientId);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Falha ao enviar "${file.name}".`);
          }
          return (await res.json()) as UploadedFile;
        })
      );
      onChange([...value, ...uploaded]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao enviar arquivos."
      );
    } finally {
      setUploading(false);
    }
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label className="text-sm font-medium text-fysi-deep">{label}</label>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "cursor-pointer rounded-[16px] border border-dashed bg-white px-6 py-8 text-center transition",
          dragOver
            ? "border-fysi-green bg-fysi-mint/30"
            : "border-fysi-line-strong hover:border-fysi-deep/30 hover:bg-fysi-cream/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm font-medium text-fysi-deep">
          {uploading
            ? "Enviando…"
            : "Clique para enviar ou arraste arquivos aqui"}
        </p>
        {hint ? (
          <p className="text-xs text-fysi-muted mt-1">{hint}</p>
        ) : (
          <p className="text-xs text-fysi-muted mt-1">
            {accept ? `Aceitos: ${accept}` : "Imagens, PDFs e documentos"}
          </p>
        )}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {value.length > 0 ? (
        <ul className="flex flex-col gap-2 mt-1">
          {value.map((file, idx) => (
            <li
              key={file.path + idx}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-fysi-line bg-white px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-8 w-8 rounded-md bg-fysi-mint flex items-center justify-center text-[0.65rem] font-medium uppercase text-fysi-deep shrink-0">
                  {extLabel(file.name)}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-fysi-deep truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-fysi-muted">
                    {humanSize(file.size)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx);
                }}
                className="text-xs text-fysi-muted hover:text-red-600 px-2 py-1 rounded"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function extLabel(name: string) {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "?";
  return name.slice(dot + 1, dot + 4).toUpperCase();
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
