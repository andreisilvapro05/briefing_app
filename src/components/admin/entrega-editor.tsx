"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { setEntregaAction } from "@/app/admin/[id]/actions";
import {
  defaultChecklists,
  defaultReferral,
  emptyAcesso,
  emptyBackup,
  emptyChecklistItem,
  emptyEntrega,
  emptyTutorial,
  entregaCompletude,
  renderEntregaMarkdown,
  type AcessoItem,
  type BackupItem,
  type ChecklistItem,
  type ChecklistsSection,
  type EntregaDocumento,
  type ReferralSection,
  type TutorialItem,
} from "@/lib/entrega";

/**
 * Editor do Documento de Entrega — etapa final do projeto.
 *
 * Admin preenche: acessos (WP/hospedagem/domínio), tutoriais, backups,
 * documentação, garantia, mensagem final. Quando bate "Finalizar entrega",
 * o doc aparece automaticamente no painel do cliente.
 */
export function EntregaEditor({
  clientId,
  clientName,
  empresa,
  urlKey,
  initial,
  finalizadaAt,
}: {
  clientId: string;
  clientName: string | null;
  empresa: string | null;
  urlKey: string | null;
  initial: EntregaDocumento | null;
  finalizadaAt: string | null;
}) {
  const [data, setData] = useState<EntregaDocumento>(initial ?? emptyEntrega());
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const completude = entregaCompletude(data);

  function update<K extends keyof EntregaDocumento>(
    key: K,
    value: EntregaDocumento[K]
  ) {
    setData((d) => ({ ...d, [key]: value }));
  }

  // --- Acessos ---
  function updateAcesso(i: number, patch: Partial<AcessoItem>) {
    setData((d) => ({
      ...d,
      acessos: d.acessos.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    }));
  }
  function addAcesso() {
    setData((d) => ({ ...d, acessos: [...d.acessos, emptyAcesso("")] }));
  }
  function removeAcesso(i: number) {
    setData((d) => ({ ...d, acessos: d.acessos.filter((_, idx) => idx !== i) }));
  }

  // --- Tutoriais ---
  function updateTutorial(i: number, patch: Partial<TutorialItem>) {
    setData((d) => ({
      ...d,
      tutoriais: d.tutoriais.map((t, idx) =>
        idx === i ? { ...t, ...patch } : t
      ),
    }));
  }
  function addTutorial() {
    setData((d) => ({ ...d, tutoriais: [...d.tutoriais, emptyTutorial()] }));
  }
  function removeTutorial(i: number) {
    setData((d) => ({
      ...d,
      tutoriais: d.tutoriais.filter((_, idx) => idx !== i),
    }));
  }

  // --- Backups ---
  function updateBackup(i: number, patch: Partial<BackupItem>) {
    setData((d) => ({
      ...d,
      backups: d.backups.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    }));
  }
  function addBackup() {
    setData((d) => ({ ...d, backups: [...d.backups, emptyBackup()] }));
  }
  function removeBackup(i: number) {
    setData((d) => ({ ...d, backups: d.backups.filter((_, idx) => idx !== i) }));
  }

  // --- Referral ---
  function updateReferral(patch: Partial<ReferralSection>) {
    setData((d) => ({
      ...d,
      referral: { ...(d.referral ?? defaultReferral()), ...patch },
    }));
  }

  // --- Checklists ---
  function getCks(): ChecklistsSection {
    return data.checklists ?? defaultChecklists();
  }
  function updateChecklist(
    key: keyof ChecklistsSection,
    i: number,
    patch: Partial<ChecklistItem>
  ) {
    setData((d) => {
      const cks = d.checklists ?? defaultChecklists();
      return {
        ...d,
        checklists: {
          ...cks,
          [key]: cks[key].map((item, idx) => (idx === i ? { ...item, ...patch } : item)),
        },
      };
    });
  }
  function addChecklistItem(key: keyof ChecklistsSection) {
    setData((d) => {
      const cks = d.checklists ?? defaultChecklists();
      return {
        ...d,
        checklists: { ...cks, [key]: [...cks[key], emptyChecklistItem()] },
      };
    });
  }
  function removeChecklistItem(key: keyof ChecklistsSection, i: number) {
    setData((d) => {
      const cks = d.checklists ?? defaultChecklists();
      return {
        ...d,
        checklists: { ...cks, [key]: cks[key].filter((_, idx) => idx !== i) },
      };
    });
  }

  function save(opts: { finalizar?: boolean; desfazer?: boolean } = {}) {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    fd.append("entregaJson", JSON.stringify(data));
    if (opts.finalizar) fd.append("finalizar", "1");
    if (opts.desfazer) fd.append("desfazerFinalizacao", "1");
    setSaveError(null);
    startTransition(async () => {
      try {
        await setEntregaAction(fd);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Erro ao salvar. Tente de novo."
        );
      }
    });
  }

  const markdown = renderEntregaMarkdown(data, {
    clientName: clientName ?? undefined,
    empresa: empresa ?? undefined,
    entregueEm: finalizadaAt
      ? new Date(finalizadaAt).toLocaleDateString("pt-BR")
      : null,
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
    a.download = `entrega-${slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div className="min-w-0">
          <Eyebrow>📦 Documento de Entrega</Eyebrow>
          <p className="text-xs text-fysi-muted mt-1">
            Acessos, tutoriais, backups e garantia.{" "}
            {finalizadaAt ? (
              <Pill tone="mint">
                ✓ Entregue em {new Date(finalizadaAt).toLocaleDateString("pt-BR")}
              </Pill>
            ) : (
              <span>· {completude.preenchidos}/{completude.total} seções preenchidas ({completude.pct}%)</span>
            )}
          </p>
          {saveError ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mt-1.5 inline-block">
              ⚠ {saveError}
            </p>
          ) : savedAt ? (
            <p className="text-xs text-emerald-700 mt-1">
              ✓ Salvo às {new Date(savedAt).toLocaleTimeString("pt-BR")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewOpen((v) => !v)}>
            {previewOpen ? "Editar" : "Pré-visualizar"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={copyMarkdown}>
            Copiar MD
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={downloadMarkdown}>
            ⬇ .md
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => save()}
            disabled={pending}
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      {previewOpen ? (
        <pre className="bg-fysi-cream/40 rounded-[12px] p-4 text-xs text-fysi-deep overflow-auto max-h-[600px] whitespace-pre-wrap font-mono leading-relaxed">
          {markdown}
        </pre>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Mensagem final */}
          <Block titulo="Mensagem final pro cliente">
            <Textarea
              value={data.mensagemFinal}
              onChange={(e) => update("mensagemFinal", e.target.value)}
              rows={3}
              placeholder="Ex: Andrei, foi um prazer trabalhar com você. Abaixo está tudo o que você precisa pra cuidar do seu site daqui pra frente. Qualquer dúvida, é só chamar 💚"
              hint="Aparece no topo do documento no painel do cliente."
            />
          </Block>

          {/* Acessos */}
          <Block titulo="🔐 Acessos">
            <p className="text-xs text-fysi-muted">
              Logins do WordPress, hospedagem, domínio. Tudo o que o cliente
              precisa pra administrar.
            </p>
            <div className="flex flex-col gap-3">
              {data.acessos.map((a, i) => (
                <div
                  key={i}
                  className="rounded-[14px] border border-fysi-line bg-fysi-cream/20 p-3 flex flex-col gap-2"
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      label="Nome do sistema"
                      value={a.nome}
                      onChange={(e) => updateAcesso(i, { nome: e.target.value })}
                      placeholder="Ex: WordPress, cPanel, Registro.br"
                    />
                    <Input
                      label="URL"
                      value={a.url}
                      onChange={(e) => updateAcesso(i, { url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      label="Usuário / login"
                      value={a.usuario}
                      onChange={(e) => updateAcesso(i, { usuario: e.target.value })}
                      placeholder="usuario ou email"
                    />
                    <Input
                      label="Senha"
                      type="password"
                      value={a.senha}
                      onChange={(e) => updateAcesso(i, { senha: e.target.value })}
                      placeholder="senha"
                    />
                  </div>
                  <Input
                    label="Notas (opcional)"
                    value={a.notas}
                    onChange={(e) => updateAcesso(i, { notas: e.target.value })}
                    placeholder="Ex: 2FA ativo, recovery email é X"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeAcesso(i)}
                      disabled={data.acessos.length <= 1}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-30"
                      aria-label="Remover acesso"
                    >
                      ✕ Remover
                    </button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addAcesso}
                className="self-start"
              >
                + Adicionar acesso
              </Button>
            </div>
          </Block>

          {/* Tutoriais */}
          <Block titulo="📺 Tutoriais">
            <div className="flex flex-col gap-3">
              {data.tutoriais.map((t, i) => (
                <div
                  key={i}
                  className="rounded-[14px] border border-fysi-line bg-fysi-cream/20 p-3 flex flex-col gap-2"
                >
                  <Input
                    label="Título"
                    value={t.titulo}
                    onChange={(e) => updateTutorial(i, { titulo: e.target.value })}
                    placeholder="Ex: Como adicionar um post"
                  />
                  <Input
                    label="Link (Loom, YouTube, Drive)"
                    value={t.url}
                    onChange={(e) => updateTutorial(i, { url: e.target.value })}
                    placeholder="https://..."
                  />
                  <Textarea
                    label="Descrição"
                    rows={2}
                    value={t.descricao}
                    onChange={(e) => updateTutorial(i, { descricao: e.target.value })}
                    placeholder="Quando assistir, etc."
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeTutorial(i)}
                      className="text-xs text-red-600 hover:text-red-800"
                      aria-label="Remover tutorial"
                    >
                      ✕ Remover
                    </button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addTutorial}
                className="self-start"
              >
                + Adicionar tutorial
              </Button>
            </div>
          </Block>

          {/* Backups */}
          <Block titulo="💾 Backups">
            <p className="text-xs text-fysi-muted">
              Links pra arquivos de backup completos do site (banco + uploads).
            </p>
            <div className="flex flex-col gap-3">
              {data.backups.map((b, i) => (
                <div
                  key={i}
                  className="rounded-[14px] border border-fysi-line bg-fysi-cream/20 p-3 flex flex-col gap-2"
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      label="Título"
                      value={b.titulo}
                      onChange={(e) => updateBackup(i, { titulo: e.target.value })}
                      placeholder="Ex: Backup completo Jul/26"
                    />
                    <Input
                      label="Data"
                      value={b.data}
                      onChange={(e) => updateBackup(i, { data: e.target.value })}
                      placeholder="Ex: 15/07/2026"
                    />
                  </div>
                  <Input
                    label="Link"
                    value={b.url}
                    onChange={(e) => updateBackup(i, { url: e.target.value })}
                    placeholder="Link Drive/Dropbox/S3"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeBackup(i)}
                      className="text-xs text-red-600 hover:text-red-800"
                      aria-label="Remover backup"
                    >
                      ✕ Remover
                    </button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addBackup}
                className="self-start"
              >
                + Adicionar backup
              </Button>
            </div>
          </Block>

          {/* Documentação */}
          <Block titulo="📄 Documentação técnica">
            <Textarea
              value={data.documentacao}
              onChange={(e) => update("documentacao", e.target.value)}
              rows={6}
              placeholder="Notas técnicas — estrutura do tema, plugins instalados, integrações ativas, particularidades do projeto. Markdown aceito."
            />
          </Block>

          {/* Garantia */}
          <Block titulo="🛡️ Garantia">
            <Textarea
              value={data.garantia}
              onChange={(e) => update("garantia", e.target.value)}
              rows={3}
              placeholder="Prazo, escopo, contato"
            />
          </Block>

          {/* Indique e Ganhe */}
          <Block titulo="🎁 Indique e Ganhe">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.referral?.ativo ?? false}
                onChange={(e) => updateReferral({ ativo: e.target.checked })}
              />
              <span>Mostrar programa &quot;Indique e Ganhe&quot; pro cliente</span>
            </label>
            {data.referral?.ativo ? (
              <>
                <Input
                  label="Valor por indicação"
                  value={data.referral?.valor ?? ""}
                  onChange={(e) => updateReferral({ valor: e.target.value })}
                  placeholder="R$ 250,00"
                />
                <Textarea
                  label="Condições / texto explicativo"
                  rows={3}
                  value={data.referral?.condicoes ?? ""}
                  onChange={(e) => updateReferral({ condicoes: e.target.value })}
                  placeholder="A cada vez que você indicar a Fysi e essa pessoa fechar conosco..."
                />
              </>
            ) : null}
          </Block>

          {/* NPS */}
          <Block titulo="📝 Formulário de satisfação (NPS)">
            <Input
              label="URL do formulário"
              value={data.npsUrl ?? ""}
              onChange={(e) => update("npsUrl", e.target.value)}
              placeholder="https://forms.google.com/..."
              hint="Cliente clica e responde — Google Forms, Typeform, etc."
            />
          </Block>

          {/* Checklists */}
          <ChecklistBlock
            titulo="🔒 Checklist de Segurança"
            items={getCks().seguranca}
            onUpdate={(i, p) => updateChecklist("seguranca", i, p)}
            onAdd={() => addChecklistItem("seguranca")}
            onRemove={(i) => removeChecklistItem("seguranca", i)}
          />
          <ChecklistBlock
            titulo="💾 Checklist de Backup"
            items={getCks().backup}
            onUpdate={(i, p) => updateChecklist("backup", i, p)}
            onAdd={() => addChecklistItem("backup")}
            onRemove={(i) => removeChecklistItem("backup", i)}
          />
          <ChecklistBlock
            titulo="✅ Checklist Obrigatório"
            items={getCks().obrigatorio}
            onUpdate={(i, p) => updateChecklist("obrigatorio", i, p)}
            onAdd={() => addChecklistItem("obrigatorio")}
            onRemove={(i) => removeChecklistItem("obrigatorio", i)}
          />
          <ChecklistBlock
            titulo="🔍 Checklist de SEO"
            items={getCks().seo}
            onUpdate={(i, p) => updateChecklist("seo", i, p)}
            onAdd={() => addChecklistItem("seo")}
            onRemove={(i) => removeChecklistItem("seo", i)}
          />
          <ChecklistBlock
            titulo="👤 Checklist do Cliente"
            items={getCks().cliente}
            onUpdate={(i, p) => updateChecklist("cliente", i, p)}
            onAdd={() => addChecklistItem("cliente")}
            onRemove={(i) => removeChecklistItem("cliente", i)}
          />

          {/* Relatório técnico */}
          <Block titulo="🔧 Relatório técnico (Site Health WP)">
            <Textarea
              value={data.relatorioTecnico ?? ""}
              onChange={(e) => update("relatorioTecnico", e.target.value)}
              rows={10}
              placeholder="Cole aqui o dump do WP-Admin → Ferramentas → Saúde do site → Aba Info → Copiar info"
              hint="Permite rastrear se algo mudou no site depois da entrega."
            />
          </Block>

          {/* Finalizar / desfazer */}
          <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-fysi-line">
            <p className="text-xs text-fysi-muted max-w-md">
              Ao finalizar, o cliente vê o documento no painel dele e o
              projeto vira status &quot;concluído&quot;.
            </p>
            {finalizadaAt ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => save({ desfazer: true })}
                disabled={pending}
              >
                Desfazer entrega
              </Button>
            ) : (
              <Button
                type="button"
                size="md"
                onClick={() => save({ finalizar: true })}
                disabled={pending || completude.pct < 50}
              >
                {pending ? "Finalizando…" : "✓ Finalizar entrega pro cliente"}
              </Button>
            )}
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

function ChecklistBlock({
  titulo,
  items,
  onUpdate,
  onAdd,
  onRemove,
}: {
  titulo: string;
  items: ChecklistItem[];
  onUpdate: (i: number, patch: Partial<ChecklistItem>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <Block titulo={titulo}>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_140px_28px] gap-2 items-center"
          >
            <Input
              value={item.label}
              onChange={(e) => onUpdate(i, { label: e.target.value })}
              placeholder="Item"
            />
            <Input
              value={item.valor}
              onChange={(e) => onUpdate(i, { valor: e.target.value })}
              placeholder="Resposta"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-30"
              disabled={items.length <= 1}
              aria-label="Remover"
            >
              ✕
            </button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onAdd}
          className="self-start"
        >
          + Adicionar
        </Button>
      </div>
    </Block>
  );
}
