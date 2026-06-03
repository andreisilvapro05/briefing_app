"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow } from "@/components/ui/pill";
import { setEIAction } from "@/app/admin/[id]/actions";
import {
  emptyEI,
  emptySecao,
  REFERENCIAS_PADRAO,
  renderEIMarkdown,
  type EIData,
  type EISecao,
} from "@/lib/ei-template";

/**
 * Editor da Estrutura Inicial (EI).
 *
 * O EI é o documento de produção que a equipe Fysi monta a partir do
 * briefing: dados de acesso, refs visuais, copy por seção. Espelha o
 * template do Notion/Word que a Sara usa hoje.
 *
 * UX: form com seções dinâmicas (adicionar/remover/reordenar). Auto-save
 * desativado de propósito — admin clica em "Salvar" pra commitar (evita
 * "tinta digital" indo pro server a cada keystroke).
 */
export function EIEditor({
  clientId,
  clientName,
  empresa,
  urlKey,
  initial,
  atualizadoAt,
}: {
  clientId: string;
  clientName: string | null;
  empresa: string | null;
  urlKey: string | null;
  initial: EIData | null;
  atualizadoAt: string | null;
}) {
  const [data, setData] = useState<EIData>(initial ?? emptyEI());
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(atualizadoAt);
  const [previewOpen, setPreviewOpen] = useState(false);

  function update<K extends keyof EIData>(key: K, value: EIData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function updateSecao(index: number, patch: Partial<EISecao>) {
    setData((d) => ({
      ...d,
      secoes: d.secoes.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addSecao() {
    setData((d) => ({
      ...d,
      secoes: [
        ...d.secoes,
        emptySecao(`SEÇÃO ${String(d.secoes.length + 1).padStart(2, "0")}`),
      ],
    }));
  }

  function removeSecao(index: number) {
    setData((d) => ({
      ...d,
      secoes: d.secoes.filter((_, i) => i !== index),
    }));
  }

  function moveSecao(index: number, direction: -1 | 1) {
    setData((d) => {
      const newIdx = index + direction;
      if (newIdx < 0 || newIdx >= d.secoes.length) return d;
      const next = [...d.secoes];
      [next[index], next[newIdx]] = [next[newIdx], next[index]];
      return { ...d, secoes: next };
    });
  }

  const [saveError, setSaveError] = useState<string | null>(null);

  function save() {
    const formData = new FormData();
    formData.append("clientId", clientId);
    if (urlKey) formData.append("key", urlKey);
    formData.append("eiJson", JSON.stringify(data));
    setSaveError(null);
    startTransition(async () => {
      try {
        await setEIAction(formData);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : "Erro ao salvar. Tente de novo em alguns segundos."
        );
      }
    });
  }

  const markdown = renderEIMarkdown(data, {
    clientName: clientName ?? undefined,
    empresa: empresa ?? undefined,
  });

  function copyMarkdown() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(markdown);
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (empresa ?? clientName ?? "cliente")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 50);
    a.download = `EI-${slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <div>
          <Eyebrow>Estrutura Inicial (EI)</Eyebrow>
          <p className="text-xs text-fysi-muted mt-1">
            Documento de produção — monta a partir do briefing.{" "}
            {savedAt ? (
              <span>
                · Salvo em {new Date(savedAt).toLocaleString("pt-BR")}
              </span>
            ) : (
              <span className="text-amber-700">· Nunca salvo</span>
            )}
          </p>
          {saveError ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mt-1.5 inline-block">
              ⚠ {saveError}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Editar" : "Pré-visualizar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={copyMarkdown}
          >
            Copiar MD
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={downloadMarkdown}
          >
            ⬇ .md
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar EI"}
          </Button>
        </div>
      </div>

      {previewOpen ? (
        <pre className="bg-fysi-cream/40 rounded-[12px] p-4 text-xs text-fysi-deep overflow-auto max-h-[600px] whitespace-pre-wrap font-mono leading-relaxed">
          {markdown}
        </pre>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Bloco acesso */}
          <Block titulo="Acesso e materiais">
            <Textarea
              label="Dados de acesso (domínio / hospedagem / WordPress)"
              value={data.dadosAcesso}
              onChange={(e) => update("dadosAcesso", e.target.value)}
              rows={3}
              placeholder="user/senha pro WordPress, painel de hospedagem, DNS..."
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Link do briefing"
                value={data.briefingLink}
                onChange={(e) => update("briefingLink", e.target.value)}
                placeholder="https://app.fysilabdigital.com.br/admin/..."
              />
              <Input
                label="Link do Drive"
                value={data.driveLink}
                onChange={(e) => update("driveLink", e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Logo"
                value={data.logo}
                onChange={(e) => update("logo", e.target.value)}
                placeholder="Link da pasta ou arquivo principal"
              />
              <Input
                label="Imagens"
                value={data.imagens}
                onChange={(e) => update("imagens", e.target.value)}
                placeholder="Link da pasta de imagens"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Fonte de letra"
                value={data.fonteLetra}
                onChange={(e) => update("fonteLetra", e.target.value)}
                placeholder="Ex: Inter, Fraunces, etc"
              />
              <Input
                label="Cores"
                value={data.cores}
                onChange={(e) => update("cores", e.target.value)}
                placeholder="#042B30, #C8E3DA..."
              />
            </div>
          </Block>

          {/* Referências */}
          <Block titulo="Referências">
            <Textarea
              label="Páginas de referência e referências visuais"
              value={data.paginasReferencia}
              onChange={(e) => update("paginasReferencia", e.target.value)}
              rows={3}
              placeholder="Cole aqui as URLs ou descreva as refs..."
            />
            <Textarea
              label="Referências gerais"
              value={data.referenciasGerais}
              onChange={(e) => update("referenciasGerais", e.target.value)}
              rows={4}
              hint="Sara: deixe o link relacionado ao nicho do projeto"
              placeholder="• Cole referências aqui"
            />
            <details className="bg-fysi-cream/40 rounded-[10px] p-3 text-xs">
              <summary className="cursor-pointer text-fysi-deep font-medium">
                💡 Refs padrão por nicho (clique pra ver)
              </summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {REFERENCIAS_PADRAO.map((r) => (
                  <button
                    key={r.url}
                    type="button"
                    onClick={() => {
                      const append = `\n• ${r.nome}: ${r.url}`;
                      update(
                        "referenciasGerais",
                        (data.referenciasGerais + append).trim()
                      );
                    }}
                    className="text-left text-fysi-deep hover:text-fysi-green underline underline-offset-2"
                  >
                    + {r.nome}: <span className="font-mono">{r.url}</span>
                  </button>
                ))}
              </div>
            </details>
          </Block>

          {/* Copy externo */}
          <Block titulo="Copy do cliente (se enviou)">
            <Textarea
              label="Informações adicionais ou copy que o cliente enviou"
              value={data.copyExterno}
              onChange={(e) => update("copyExterno", e.target.value)}
              rows={4}
              placeholder="Cole aqui o que o cliente já mandou pronto"
            />
          </Block>

          {/* Copy */}
          <Block titulo="COPY — estrutura de seções">
            <Input
              label="MENU tem?"
              value={data.menuTem}
              onChange={(e) => update("menuTem", e.target.value)}
              placeholder="Ex: Sim — Home, Sobre, Serviços, Depoimentos, Contato"
            />

            <div className="flex flex-col gap-4 mt-2">
              {data.secoes.map((s, i) => (
                <SecaoEditor
                  key={i}
                  secao={s}
                  index={i}
                  total={data.secoes.length}
                  onChange={(patch) => updateSecao(i, patch)}
                  onRemove={() => removeSecao(i)}
                  onMove={(dir) => moveSecao(i, dir)}
                />
              ))}
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={addSecao}
              className="self-start mt-2"
            >
              + Adicionar seção
            </Button>
          </Block>

          {/* Rodapé */}
          <Block titulo="RODAPÉ">
            <Textarea
              label="Texto / estrutura do rodapé"
              value={data.rodape}
              onChange={(e) => update("rodape", e.target.value)}
              rows={3}
              placeholder="Endereço, redes sociais, CNPJ, copyright..."
            />
          </Block>

          {/* Salvar duplicado embaixo (UX) */}
          <div className="flex justify-end pt-2 border-t border-fysi-line">
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar EI"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Block({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-fysi-line pt-4">
      <legend className="text-[0.7rem] uppercase tracking-[0.12em] font-semibold text-fysi-deep -ml-2 px-2 bg-white">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

function SecaoEditor({
  secao,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  secao: EISecao;
  index: number;
  total: number;
  onChange: (patch: Partial<EISecao>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-[14px] border border-fysi-line bg-fysi-cream/30 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Input
            value={secao.nome}
            onChange={(e) => onChange({ nome: e.target.value })}
            placeholder="SEÇÃO 01"
          />
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="text-xs text-fysi-muted hover:text-fysi-deep disabled:opacity-30 px-2"
            title="Mover pra cima"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="text-xs text-fysi-muted hover:text-fysi-deep disabled:opacity-30 px-2"
            title="Mover pra baixo"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-30 px-2"
            title="Remover seção"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          label="*obs"
          value={secao.obs}
          onChange={(e) => onChange({ obs: e.target.value })}
          placeholder="Nota interna pra equipe"
        />
        <Input
          label="Ref"
          value={secao.ref}
          onChange={(e) => onChange({ ref: e.target.value })}
          placeholder="Link de referência visual"
        />
      </div>

      <Input
        label="[Título]"
        value={secao.titulo}
        onChange={(e) => onChange({ titulo: e.target.value })}
        placeholder="Título principal da seção"
      />
      <Textarea
        label="[Texto]"
        value={secao.texto}
        onChange={(e) => onChange({ texto: e.target.value })}
        rows={3}
        placeholder="Copy / texto da seção"
      />
      <Input
        label="[CTA] (opcional)"
        value={secao.cta}
        onChange={(e) => onChange({ cta: e.target.value })}
        placeholder="Ex: AGENDAR CONSULTA"
      />
    </div>
  );
}
