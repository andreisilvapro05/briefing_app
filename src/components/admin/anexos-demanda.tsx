"use client";

import { useRef, useState, useTransition } from "react";
import {
  humanizarTamanho,
  linkValido,
  MAX_ANEXO_BYTES,
  MAX_UPLOAD_LABEL,
  type AnexoDemanda,
} from "@/lib/anexos-demanda";
import {
  adicionarAnexoDemandaAction,
  removerAnexoDemandaAction,
} from "@/app/admin/[id]/actions";

/**
 * Anexos de uma demanda — o arquivo em si ou o link de onde ele mora.
 *
 * Karine (2026-09-30): "na parte de demandas ter uma parte para anexar o
 * arquivo ou link de arquivos". O link vem primeiro no formulário porque é
 * o caso comum: a agência trabalha em pastas do Drive, e colar o endereço
 * é mais rápido — e sem teto de tamanho — do que subir o arquivo.
 */
export function AnexosDemanda({
  taskId,
  anexos,
  urlKey,
  onMudou,
}: {
  taskId: string;
  anexos: AnexoDemanda[];
  urlKey?: string | null;
  /** A lista vem do servidor: sem isto, o anexo novo só apareceria no F5. */
  onMudou: () => void;
}) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);

  function enviar(fd: FormData) {
    fd.append("taskId", taskId);
    if (urlKey) fd.append("key", urlKey);
    setErro(null);
    startTransition(async () => {
      const r = await adicionarAnexoDemandaAction(fd);
      if (!r.ok) {
        setErro(r.erro ?? "Não consegui anexar.");
        return;
      }
      setUrl("");
      if (arquivoRef.current) arquivoRef.current.value = "";
      onMudou();
    });
  }

  function anexarLink() {
    if (!linkValido(url)) {
      setErro("Cole um link que comece com http:// ou https://.");
      return;
    }
    const fd = new FormData();
    fd.append("url", url.trim());
    enviar(fd);
  }

  function anexarArquivo(file: File) {
    // Barra aqui também, não só no servidor: mandar 20 MB pra ouvir "não"
    // do outro lado é esperar à toa por uma resposta que já se sabe.
    if (file.size > MAX_ANEXO_BYTES) {
      setErro(`Arquivo acima de ${MAX_UPLOAD_LABEL}. Suba no Drive e cole o link aqui.`);
      if (arquivoRef.current) arquivoRef.current.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("arquivo", file);
    enviar(fd);
  }

  function remover(anexo: AnexoDemanda) {
    if (!window.confirm(`Tirar "${anexo.nome}" desta demanda?`)) return;
    const fd = new FormData();
    fd.append("taskId", taskId);
    fd.append("anexoId", anexo.id);
    if (urlKey) fd.append("key", urlKey);
    setErro(null);
    startTransition(async () => {
      const r = await removerAnexoDemandaAction(fd);
      if (!r.ok) {
        setErro(r.erro ?? "Não consegui remover.");
        return;
      }
      onMudou();
    });
  }

  const campo =
    "rounded-[10px] border border-fysi-line bg-white px-3 py-1.5 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40 disabled:opacity-50";

  return (
    <div>
      <p className="text-[0.7rem] uppercase tracking-[0.08em] text-fysi-muted font-medium mb-1">
        Anexos
      </p>

      {anexos.length > 0 ? (
        <ul className="flex flex-col gap-1 mb-2">
          {anexos.map((a) => {
            const href =
              a.tipo === "link"
                ? (a.url ?? "#")
                : `/api/admin/anexos/${taskId}/${a.id}${
                    urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""
                  }`;
            return (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-[10px] border border-fysi-line bg-white px-2.5 py-1.5"
              >
                <span
                  className="text-fysi-muted shrink-0"
                  title={a.tipo === "link" ? "Link" : "Arquivo"}
                >
                  {a.tipo === "link" ? <IconeLink /> : <IconeArquivo />}
                </span>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-fysi-deep hover:underline truncate"
                  title={a.nome}
                >
                  {a.nome}
                </a>
                {a.tamanho ? (
                  <span className="text-[0.68rem] text-fysi-muted tabular-nums shrink-0">
                    {humanizarTamanho(a.tamanho)}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => remover(a)}
                  aria-label={`Tirar "${a.nome}"`}
                  className="ml-auto shrink-0 text-fysi-muted/70 hover:text-red-700 transition disabled:opacity-50"
                >
                  <IconeX />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={url}
          disabled={pendente}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              anexarLink();
            }
          }}
          placeholder="Cole o link da pasta ou do arquivo"
          className={`${campo} flex-1 min-w-[16rem]`}
        />
        <button
          type="button"
          disabled={pendente || !url.trim()}
          onClick={anexarLink}
          className="rounded-full border border-fysi-line bg-white px-3 py-1.5 text-sm text-fysi-deep hover:border-fysi-deep/40 transition disabled:opacity-50"
        >
          Anexar link
        </button>
        <label className="rounded-full border border-fysi-line bg-white px-3 py-1.5 text-sm text-fysi-deep hover:border-fysi-deep/40 transition cursor-pointer">
          {pendente ? "Enviando…" : "Subir arquivo"}
          <input
            ref={arquivoRef}
            type="file"
            disabled={pendente}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) anexarArquivo(f);
            }}
          />
        </label>
      </div>
      <p className="text-[0.68rem] text-fysi-muted mt-1">
        {`Arquivo até ${MAX_UPLOAD_LABEL}. Maior que isso, suba no Drive e cole o link.`}
      </p>

      {erro ? (
        <p className="text-xs text-red-700 mt-1" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

const TRACO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconeLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...TRACO}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  );
}

function IconeArquivo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...TRACO}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function IconeX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...TRACO}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
