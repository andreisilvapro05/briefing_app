"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/pill";

/**
 * Permite o admin subir o modelo de contrato (.docx). Substitui o atual.
 * Aparece no topo de /admin/contratos.
 */
export function TemplateUploader({
  urlKey,
  currentTemplateUpdatedAt,
}: {
  urlKey?: string;
  currentTemplateUpdatedAt?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleUpload() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setMsg("Escolha um arquivo .docx primeiro.");
      setStatus("error");
      return;
    }
    setStatus("uploading");
    setMsg(null);

    const fd = new FormData();
    fd.append("file", f);

    const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
    try {
      const res = await fetch(
        `/api/admin/contracts/template/upload${keyParam}`,
        { method: "POST", body: fd }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMsg(`Falha: ${data.error || `HTTP ${res.status}`}`);
        return;
      }
      setStatus("success");
      setMsg("Modelo atualizado com sucesso.");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <Eyebrow>Modelo do contrato</Eyebrow>
        {currentTemplateUpdatedAt ? (
          <span className="text-xs text-fysi-deep">
            ✅ modelo atualizado em {formatDate(currentTemplateUpdatedAt)}
          </span>
        ) : (
          <span className="text-xs text-amber-700">
            ⚠️ nenhum modelo subido ainda
          </span>
        )}
      </div>
      <p className="text-sm text-fysi-muted mt-2 mb-4">
        Suba o <code className="font-mono text-xs">.docx</code> com as tags{" "}
        <code className="font-mono text-xs">{`{{nome_cliente}}`}</code>,{" "}
        <code className="font-mono text-xs">{`{{valor_parcelamento}}`}</code>{" "}
        etc. Substitui o modelo atual (não dá pra desfazer).
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          className="text-sm text-fysi-deep file:mr-3 file:rounded-full file:border-0 file:bg-fysi-cream file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-fysi-mint"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={status === "uploading"}
          onClick={handleUpload}
        >
          {status === "uploading" ? "Enviando…" : "Atualizar modelo"}
        </Button>
        {msg ? (
          <span
            className={
              status === "error"
                ? "text-xs text-red-600"
                : "text-xs text-fysi-deep"
            }
          >
            {msg}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
