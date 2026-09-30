"use client";

import { useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, acimaDoLimite } from "@/lib/uploads";

/**
 * Campo de arquivo que recusa o arquivo grande AQUI, antes de enviar.
 *
 * Sem isto a recusa é invisível: o arquivo estoura o limite de corpo da
 * Vercel, a Server Action nem chega a rodar, e a tela volta sem salvar e
 * sem dizer por quê. A validação do servidor não alcança esse caso — ela
 * roda depois do transporte.
 *
 * Limpar o input também importa: deixar o nome do arquivo recusado no
 * campo faz a pessoa mandar o formulário achando que ele vai junto.
 */
export function CampoArquivo({
  name,
  accept,
  label,
  className,
}: {
  name: string;
  accept?: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-medium">
        {label} — até {MAX_UPLOAD_LABEL}
      </span>
      <input
        ref={ref}
        name={name}
        type="file"
        accept={accept}
        className={
          className ??
          "text-sm text-fysi-deep file:mr-3 file:rounded-full file:border-0 file:bg-fysi-cream file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-fysi-mint"
        }
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && acimaDoLimite(f.size)) {
            setErro(
              `Esse arquivo tem ${(f.size / 1024 / 1024).toFixed(1)} MB e o limite é ${MAX_UPLOAD_LABEL}. Suba no Drive e cole o link na demanda, ou mande um print menor.`
            );
            if (ref.current) ref.current.value = "";
            return;
          }
          setErro(null);
        }}
      />
      {erro ? (
        <p className="text-xs text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

export { MAX_UPLOAD_BYTES };
