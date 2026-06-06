"use client";

import { useState } from "react";
import { Eyebrow } from "@/components/ui/pill";
import {
  renderEntregaMarkdown,
  type ChecklistItem,
  type EntregaDocumento,
} from "@/lib/entrega";

/**
 * Visualizador do DEP — Documento de Entrega de Projeto.
 *
 * Aparece quando entrega_finalizada_at está preenchido. Renderiza
 * SUMÁRIO + todas as seções preenchidas em formato amigável (estilo
 * apostila), e permite ao cliente:
 *   - Preencher domínio + hospedagem dele
 *   - Baixar o DEP em Markdown
 *   - Imprimir / salvar como PDF via browser
 */
export function EntregaViewer({
  clientId,
  clientName,
  empresa,
  entrega,
  finalizadaAt,
}: {
  clientId: string;
  clientName?: string;
  empresa?: string;
  entrega: EntregaDocumento;
  finalizadaAt: string | null;
}) {
  const acessosValidos = entrega.acessos.filter(
    (a) => a.nome.trim() && (a.url.trim() || a.usuario.trim() || a.senha.trim())
  );
  const tutoriaisValidos = entrega.tutoriais.filter((t) => t.titulo.trim());
  const backupsValidos = entrega.backups.filter((b) => b.titulo.trim());

  // Estado local pros campos do cliente
  const [dominio, setDominio] = useState(entrega.clienteDominio ?? "");
  const [hospedagem, setHospedagem] = useState(entrega.clienteHospedagem ?? "");
  const [savingCliente, setSavingCliente] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(
    entrega.clienteAtualizadoAt ?? null
  );
  const [error, setError] = useState<string | null>(null);

  async function saveCliente() {
    setSavingCliente(true);
    setError(null);
    try {
      const res = await fetch("/api/me/entrega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clienteDominio: dominio,
          clienteHospedagem: hospedagem,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Falha ao salvar.");
      }
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSavingCliente(false);
    }
  }

  function downloadMarkdown() {
    const md = renderEntregaMarkdown(
      { ...entrega, clienteDominio: dominio, clienteHospedagem: hospedagem },
      {
        clientName,
        empresa,
        entregueEm: finalizadaAt
          ? new Date(finalizadaAt).toLocaleDateString("pt-BR")
          : null,
      }
    );
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (empresa ?? clientName ?? "cliente")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 50);
    a.download = `DEP-${slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printPage() {
    if (typeof window !== "undefined") window.print();
  }

  // Sumário dinâmico — só seções com conteúdo
  const sumario: Array<{ id: string; label: string }> = [
    acessosValidos.length > 0 && { id: "acessos", label: "Dados de acesso" },
    tutoriaisValidos.length > 0 && { id: "tutoriais", label: "Tutoriais" },
    backupsValidos.length > 0 && { id: "backups", label: "Backups" },
    entrega.documentacao?.trim() && {
      id: "doc",
      label: "Documentação técnica",
    },
    entrega.garantia?.trim() && { id: "garantia", label: "Garantia" },
    entrega.referral?.ativo &&
      entrega.referral?.valor?.trim() && {
        id: "referral",
        label: "Indique e Ganhe",
      },
    entrega.npsUrl?.trim() && { id: "nps", label: "Pesquisa de satisfação" },
    hasChecklists(entrega) && { id: "checklists", label: "Checklists" },
    { id: "cliente", label: "Domínio e hospedagem (você preenche)" },
    entrega.relatorioTecnico?.trim() && {
      id: "tecnico",
      label: "Relatório técnico",
    },
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  return (
    <section
      className="bg-white border border-fysi-mint-vivid/30 rounded-[24px] p-6 md:p-8 print:border-none print:p-0"
      id="dep-content"
    >
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap print:flex-col">
        <div>
          <Eyebrow>📦 Documento de Entrega de Projeto</Eyebrow>
          <h2 className="fysi-display text-2xl md:text-3xl mt-1">
            DEP · {empresa || clientName || "Cliente"}
          </h2>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={downloadMarkdown}
            className="inline-flex items-center gap-1 rounded-full border border-fysi-line text-xs font-medium px-3 py-2 text-fysi-deep hover:border-fysi-deep/40"
          >
            ⬇ Baixar .md
          </button>
          <button
            type="button"
            onClick={printPage}
            className="inline-flex items-center gap-1 rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-2 hover:bg-fysi-deep/90"
          >
            🖨️ Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {finalizadaAt ? (
        <p className="text-xs text-fysi-muted mb-4">
          Entregue em{" "}
          {new Date(finalizadaAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      ) : null}

      {/* Mensagem final */}
      {entrega.mensagemFinal.trim() ? (
        <div className="rounded-[16px] bg-fysi-mint border border-fysi-mint-vivid/30 px-4 py-3 mb-6">
          <p className="text-sm text-fysi-deep leading-relaxed whitespace-pre-wrap">
            {entrega.mensagemFinal}
          </p>
        </div>
      ) : null}

      {/* Sumário */}
      <div className="rounded-[14px] bg-fysi-cream/40 border border-fysi-line px-4 py-3 mb-6">
        <p className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep mb-2">
          📑 Sumário
        </p>
        <ol className="text-sm text-fysi-deep flex flex-col gap-1 list-decimal list-inside">
          {sumario.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-fysi-deep hover:underline ml-1"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-7">
        {/* Acessos */}
        {acessosValidos.length > 0 ? (
          <Section id="acessos" titulo="🔐 Dados de acesso">
            <div className="grid sm:grid-cols-2 gap-3">
              {acessosValidos.map((a, i) => (
                <AcessoCard key={i} acesso={a} />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Tutoriais */}
        {tutoriaisValidos.length > 0 ? (
          <Section id="tutoriais" titulo="📺 Tutoriais">
            <ul className="flex flex-col gap-2">
              {tutoriaisValidos.map((t, i) => (
                <li key={i}>
                  {t.url ? (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-fysi-cream/40 border border-fysi-line rounded-[14px] px-4 py-3 hover:border-fysi-deep/40 transition group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-fysi-deep group-hover:underline">
                            {t.titulo}
                          </div>
                          {t.descricao ? (
                            <div className="text-xs text-fysi-muted mt-0.5">
                              {t.descricao}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-fysi-muted shrink-0">↗</span>
                      </div>
                    </a>
                  ) : (
                    <div className="bg-fysi-cream/40 border border-fysi-line rounded-[14px] px-4 py-3">
                      <div className="text-sm font-medium text-fysi-deep">
                        {t.titulo}
                      </div>
                      {t.descricao ? (
                        <div className="text-xs text-fysi-muted mt-0.5">
                          {t.descricao}
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Backups */}
        {backupsValidos.length > 0 ? (
          <Section id="backups" titulo="💾 Backups">
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
                  {b.url ? (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-fysi-deep hover:underline shrink-0"
                    >
                      Baixar →
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Documentação */}
        {entrega.documentacao?.trim() ? (
          <Section id="doc" titulo="📄 Documentação técnica">
            <div className="bg-fysi-cream/40 rounded-[14px] p-4 text-sm text-fysi-deep whitespace-pre-wrap leading-relaxed">
              {entrega.documentacao}
            </div>
          </Section>
        ) : null}

        {/* Garantia */}
        {entrega.garantia?.trim() ? (
          <Section id="garantia" titulo="🛡️ Garantia">
            <div className="bg-fysi-yellow/20 border-2 border-fysi-yellow rounded-[16px] p-4">
              <p className="text-sm text-fysi-deep leading-relaxed">
                {entrega.garantia}
              </p>
            </div>
          </Section>
        ) : null}

        {/* Indique e Ganhe */}
        {entrega.referral?.ativo && entrega.referral.valor.trim() ? (
          <Section id="referral" titulo="🎁 Bora de bônus? Indique e Ganhe!">
            <div className="bg-fysi-mint border border-fysi-mint-vivid/30 rounded-[16px] p-5">
              <p className="text-xl font-semibold text-fysi-deep mb-2">
                {entrega.referral.valor}
              </p>
              <p className="text-sm text-fysi-deep/80 leading-relaxed">
                {entrega.referral.condicoes}
              </p>
            </div>
          </Section>
        ) : null}

        {/* NPS */}
        {entrega.npsUrl?.trim() ? (
          <Section id="nps" titulo="📝 Pesquisa de satisfação">
            <div className="rounded-[16px] border border-fysi-line bg-fysi-cream/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-fysi-deep leading-relaxed">
                Conta pra gente como foi sua experiência. Sua opinião nos ajuda
                a melhorar.
              </p>
              <a
                href={entrega.npsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-4 py-2 hover:bg-fysi-deep/90 shrink-0"
              >
                Responder →
              </a>
            </div>
          </Section>
        ) : null}

        {/* Checklists */}
        {hasChecklists(entrega) ? (
          <Section id="checklists" titulo="✅ Checklists do projeto">
            <div className="grid md:grid-cols-2 gap-3">
              <ChecklistCard
                titulo="🔒 Segurança"
                items={entrega.checklists?.seguranca ?? []}
              />
              <ChecklistCard
                titulo="💾 Backup"
                items={entrega.checklists?.backup ?? []}
              />
              <ChecklistCard
                titulo="✅ Obrigatório"
                items={entrega.checklists?.obrigatorio ?? []}
              />
              <ChecklistCard
                titulo="🔍 SEO"
                items={entrega.checklists?.seo ?? []}
              />
              <ChecklistCard
                titulo="👤 Cliente"
                items={entrega.checklists?.cliente ?? []}
              />
            </div>
          </Section>
        ) : null}

        {/* Cliente preenche */}
        <Section id="cliente" titulo="🌐 Domínio e hospedagem (você preenche)">
          <div className="rounded-[16px] border-2 border-fysi-yellow bg-fysi-yellow/10 p-4 flex flex-col gap-3 print:break-inside-avoid">
            <p className="text-xs text-fysi-deep/80 leading-relaxed">
              Anote aqui pra ter sempre à mão. Fica salvo no seu painel.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-medium text-fysi-deep">
                Domínio
              </span>
              <input
                type="text"
                value={dominio}
                onChange={(e) => setDominio(e.target.value)}
                placeholder="Ex: meusite.com.br (registrado em GoDaddy/Registro.br)"
                className="h-10 rounded-[10px] border border-fysi-line bg-white px-3 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[0.7rem] uppercase tracking-[0.1em] font-medium text-fysi-deep">
                Hospedagem
              </span>
              <input
                type="text"
                value={hospedagem}
                onChange={(e) => setHospedagem(e.target.value)}
                placeholder="Ex: Hostinger (plano Premium até 12/2026)"
                className="h-10 rounded-[10px] border border-fysi-line bg-white px-3 text-sm text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
              />
            </label>
            <div className="flex items-center justify-between gap-3 print:hidden">
              <p className="text-[0.7rem] text-fysi-muted">
                {savedAt
                  ? `Salvo em ${new Date(savedAt).toLocaleString("pt-BR")}`
                  : "Ainda não salvo"}
              </p>
              <button
                type="button"
                onClick={saveCliente}
                disabled={savingCliente}
                className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-4 py-2 hover:bg-fysi-deep/90 disabled:opacity-60"
              >
                {savingCliente ? "Salvando…" : "Salvar"}
              </button>
            </div>
            {error ? (
              <p className="text-xs text-red-700">⚠ {error}</p>
            ) : null}
          </div>
        </Section>

        {/* Relatório técnico */}
        {entrega.relatorioTecnico?.trim() ? (
          <Section id="tecnico" titulo="🔧 Relatório técnico">
            <p className="text-xs text-fysi-muted mb-2">
              Permite verificar se alguma alteração foi feita no site
              posteriormente.
            </p>
            <pre className="bg-fysi-cream/40 rounded-[10px] p-3 text-[0.7rem] text-fysi-deep overflow-auto max-h-[400px] whitespace-pre-wrap font-mono leading-relaxed">
              {entrega.relatorioTecnico}
            </pre>
          </Section>
        ) : null}

        <p className="text-center text-xs text-fysi-muted pt-4 border-t border-fysi-line">
          Fysi Lab · obrigado pela confiança 💚
        </p>
      </div>
    </section>
  );
}

function Section({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 print:break-inside-avoid print:mt-4"
    >
      <h3 className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep mb-3">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function AcessoCard({ acesso }: { acesso: EntregaDocumento["acessos"][number] }) {
  return (
    <div className="rounded-[14px] border border-fysi-line bg-fysi-cream/30 p-3 flex flex-col gap-2 print:break-inside-avoid">
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
          className="text-fysi-muted hover:text-fysi-deep text-xs px-1 shrink-0 print:hidden"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? "🙈" : "👁"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={copy}
        className="text-fysi-deep hover:underline text-[0.7rem] font-medium shrink-0 print:hidden"
      >
        {copied ? "✓" : "Copiar"}
      </button>
    </div>
  );
}

function ChecklistCard({
  titulo,
  items,
}: {
  titulo: string;
  items: ChecklistItem[];
}) {
  const valid = items.filter((i) => i.label.trim());
  if (valid.length === 0) return null;
  return (
    <div className="rounded-[14px] border border-fysi-line bg-fysi-cream/30 p-3 print:break-inside-avoid">
      <p className="text-[0.7rem] uppercase tracking-[0.1em] font-semibold text-fysi-deep mb-2">
        {titulo}
      </p>
      <ul className="flex flex-col gap-1.5">
        {valid.map((item, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between gap-3 text-xs"
          >
            <span className="text-fysi-deep/80 min-w-0">{item.label}</span>
            <span className="text-fysi-deep font-medium tabular-nums shrink-0">
              {item.valor || "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function hasChecklists(doc: EntregaDocumento): boolean {
  const c = doc.checklists;
  if (!c) return false;
  return (
    c.seguranca.some((i) => i.label.trim()) ||
    c.backup.some((i) => i.label.trim()) ||
    c.obrigatorio.some((i) => i.label.trim()) ||
    c.seo.some((i) => i.label.trim()) ||
    c.cliente.some((i) => i.label.trim())
  );
}
