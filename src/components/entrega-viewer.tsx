"use client";

import { useState } from "react";
import { Eyebrow } from "@/components/ui/pill";
import type { EntregaDocumento } from "@/lib/entrega";

/**
 * Visualizador do Documento de Entrega no painel do cliente.
 * Aparece quando entrega_finalizada_at está preenchido.
 *
 * Foca em "deixar o cliente bem servido" — copy fácil de cada senha,
 * tutoriais como cards clicáveis, garantia destacada.
 */
export function EntregaViewer({
  entrega,
  finalizadaAt,
}: {
  entrega: EntregaDocumento;
  finalizadaAt: string | null;
}) {
  const acessosValidos = entrega.acessos.filter(
    (a) => a.nome.trim() && (a.url.trim() || a.usuario.trim() || a.senha.trim())
  );
  const tutoriaisValidos = entrega.tutoriais.filter((t) => t.titulo.trim());
  const backupsValidos = entrega.backups.filter((b) => b.titulo.trim());

  return (
    <section className="bg-white border border-fysi-mint-vivid/30 rounded-[24px] p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <div>
          <Eyebrow>📦 Documento de Entrega</Eyebrow>
          <h2 className="fysi-display text-xl md:text-2xl mt-1">
            Tudo o que você precisa
          </h2>
        </div>
        {finalizadaAt ? (
          <span className="text-xs text-fysi-muted">
            Entregue em{" "}
            {new Date(finalizadaAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </span>
        ) : null}
      </div>

      {/* Mensagem final */}
      {entrega.mensagemFinal.trim() ? (
        <div className="rounded-[16px] bg-fysi-mint border border-fysi-mint-vivid/30 px-4 py-3 mb-6">
          <p className="text-sm text-fysi-deep leading-relaxed whitespace-pre-wrap">
            {entrega.mensagemFinal}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {/* Acessos */}
        {acessosValidos.length > 0 ? (
          <section>
            <h3 className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep mb-3">
              🔐 Acessos
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {acessosValidos.map((a, i) => (
                <AcessoCard key={i} acesso={a} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Tutoriais */}
        {tutoriaisValidos.length > 0 ? (
          <section>
            <h3 className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep mb-3">
              📺 Tutoriais
            </h3>
            <ul className="flex flex-col gap-2">
              {tutoriaisValidos.map((t, i) => (
                <li key={i}>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-fysi-cream/40 border border-fysi-line rounded-[14px] px-4 py-3 hover:border-fysi-deep/40 transition group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-fysi-deep group-hover:underline truncate">
                          {t.titulo}
                        </div>
                        {t.descricao ? (
                          <div className="text-xs text-fysi-muted mt-0.5 truncate">
                            {t.descricao}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-fysi-muted shrink-0">→</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Backups */}
        {backupsValidos.length > 0 ? (
          <section>
            <h3 className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep mb-3">
              💾 Backups
            </h3>
            <ul className="flex flex-col gap-1.5">
              {backupsValidos.map((b, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 bg-fysi-cream/40 rounded-[10px] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="text-fysi-deep font-medium truncate">
                      {b.titulo}
                    </div>
                    {b.data ? (
                      <div className="text-[0.7rem] text-fysi-muted">{b.data}</div>
                    ) : null}
                  </div>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-fysi-deep hover:underline shrink-0"
                  >
                    Baixar →
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Documentação */}
        {entrega.documentacao.trim() ? (
          <section>
            <h3 className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep mb-3">
              📄 Documentação técnica
            </h3>
            <div className="bg-fysi-cream/40 rounded-[14px] p-4 text-sm text-fysi-deep whitespace-pre-wrap leading-relaxed">
              {entrega.documentacao}
            </div>
          </section>
        ) : null}

        {/* Garantia */}
        {entrega.garantia.trim() ? (
          <section className="bg-fysi-yellow/20 border-2 border-fysi-yellow rounded-[16px] p-4">
            <h3 className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep mb-2">
              🛡️ Garantia
            </h3>
            <p className="text-sm text-fysi-deep leading-relaxed">
              {entrega.garantia}
            </p>
          </section>
        ) : null}

        <p className="text-center text-xs text-fysi-muted pt-4 border-t border-fysi-line">
          Fysi Lab · obrigado pela confiança 💚
        </p>
      </div>
    </section>
  );
}

function AcessoCard({ acesso }: { acesso: EntregaDocumento["acessos"][number] }) {
  return (
    <div className="rounded-[14px] border border-fysi-line bg-fysi-cream/30 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-fysi-deep truncate">
          {acesso.nome}
        </div>
        {acesso.url ? (
          <a
            href={acesso.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-fysi-deep hover:underline shrink-0"
          >
            Abrir →
          </a>
        ) : null}
      </div>
      {acesso.usuario ? (
        <CopyRow label="Usuário" value={acesso.usuario} />
      ) : null}
      {acesso.senha ? <CopyRow label="Senha" value={acesso.senha} mask /> : null}
      {acesso.notas ? (
        <p className="text-[0.7rem] text-fysi-muted leading-snug mt-1">
          {acesso.notas}
        </p>
      ) : null}
    </div>
  );
}

function CopyRow({
  label,
  value,
  mask = false,
}: {
  label: string;
  value: string;
  mask?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(!mask);

  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[0.65rem] uppercase tracking-[0.08em] text-fysi-muted font-medium w-16 shrink-0">
        {label}
      </span>
      <code className="font-mono text-fysi-deep bg-white px-2 py-1 rounded-md flex-1 truncate min-w-0">
        {visible ? value : "•".repeat(Math.min(value.length, 12))}
      </code>
      {mask ? (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-fysi-muted hover:text-fysi-deep text-xs px-1 shrink-0"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? "👁‍🗨" : "👁"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={copy}
        className="text-fysi-deep hover:underline text-[0.7rem] font-medium shrink-0"
      >
        {copied ? "✓" : "Copiar"}
      </button>
    </div>
  );
}
