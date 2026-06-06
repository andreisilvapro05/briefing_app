"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { setMoodboardAction } from "@/app/admin/[id]/actions";
import {
  emptyComentario,
  emptyItem,
  emptyMoodboard,
  itemStatusEmoji,
  moodboardStats,
  statusLabel,
  type Moodboard,
  type MoodboardItem,
  type MoodboardItemTipo,
  type MoodboardStatus,
} from "@/lib/moodboard";

/**
 * Editor de Moodboard — pra equipe organizar referências (cores,
 * imagens, links, notas) ANTES de partir pro design.
 *
 * Opcional — só usar em projetos que precisam de alinhamento de mood.
 * Quando admin "envia ao cliente", status vira 'enviado' e o cliente
 * pode revisar / aprovar / comentar no painel dele.
 */
export function MoodboardEditor({
  clientId,
  urlKey,
  initial,
  atualizadoAt,
}: {
  clientId: string;
  urlKey: string | null;
  initial: Moodboard | null;
  atualizadoAt: string | null;
}) {
  const [data, setData] = useState<Moodboard>(initial ?? emptyMoodboard());
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(atualizadoAt);

  const stats = moodboardStats(data);

  function updateTop<K extends keyof Moodboard>(key: K, value: Moodboard[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function updateItem(id: string, patch: Partial<MoodboardItem>) {
    setData((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }

  function addItem(tipo: MoodboardItemTipo) {
    setData((d) => ({ ...d, items: [...d.items, emptyItem(tipo)] }));
  }

  function removeItem(id: string) {
    setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
  }

  function moveItem(id: string, direction: -1 | 1) {
    setData((d) => {
      const idx = d.items.findIndex((i) => i.id === id);
      const newIdx = idx + direction;
      if (idx === -1 || newIdx < 0 || newIdx >= d.items.length) return d;
      const next = [...d.items];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return { ...d, items: next };
    });
  }

  function addAdminComment(itemId: string, texto: string) {
    if (!texto.trim()) return;
    setData((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              comentarios: [...i.comentarios, emptyComentario("admin", texto)],
            }
          : i
      ),
    }));
  }

  function setStatusGeral(s: MoodboardStatus) {
    setData((d) => ({
      ...d,
      status: s,
      enviado_em: s === "enviado" && !d.enviado_em ? new Date().toISOString() : d.enviado_em,
    }));
  }

  function save() {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    fd.append("moodboardJson", JSON.stringify(data));
    setSaveError(null);
    startTransition(async () => {
      try {
        await setMoodboardAction(fd);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Erro ao salvar."
        );
      }
    });
  }

  function enviarAoCliente() {
    setStatusGeral("enviado");
    setTimeout(save, 50);
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Eyebrow>🎨 Moodboard (opcional)</Eyebrow>
            <Pill
              tone={
                data.status === "aprovado"
                  ? "mint"
                  : data.status === "enviado" || data.status === "em_revisao"
                    ? "yellow"
                    : "muted"
              }
            >
              {statusLabel(data.status)}
            </Pill>
          </div>
          <p className="text-xs text-fysi-muted mt-1">
            {stats.total > 0
              ? `${stats.total} cards · ${stats.aprovados} aprovados · ${stats.pendentes} pendentes · ${stats.comentarios} comentários`
              : "Use pra organizar referências antes do design. Cliente revisa quando você enviar."}
          </p>
          {saveError ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mt-1.5 inline-block">
              ⚠ {saveError}
            </p>
          ) : savedAt ? (
            <p className="text-xs text-emerald-700 mt-1">
              ✓ Salvo em {new Date(savedAt).toLocaleTimeString("pt-BR")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data.status === "rascunho" || data.status === "em_revisao" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={enviarAoCliente}
              disabled={pending || data.items.length === 0}
            >
              📤 Enviar ao cliente
            </Button>
          ) : null}
          {data.status === "enviado" || data.status === "em_revisao" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatusGeral("rascunho");
                setTimeout(save, 50);
              }}
            >
              Voltar a rascunho
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Título do moodboard"
          value={data.titulo}
          onChange={(e) => updateTop("titulo", e.target.value)}
          placeholder="Ex: Direção visual — Landing Dra. Fernanda"
        />
        <Textarea
          label="Descrição / contexto"
          rows={2}
          value={data.descricao}
          onChange={(e) => updateTop("descricao", e.target.value)}
          placeholder="Explica o que o cliente vai ver aqui."
        />

        {/* Toolbar add cards */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-fysi-line">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted font-medium self-center mr-2">
            Adicionar card:
          </span>
          {(["imagem", "link", "nota", "cor"] as MoodboardItemTipo[]).map(
            (t) => (
              <button
                key={t}
                type="button"
                onClick={() => addItem(t)}
                className="inline-flex items-center gap-1.5 rounded-full border border-fysi-line bg-white px-3 py-1.5 text-xs hover:border-fysi-deep/40 text-fysi-deep"
              >
                {tipoIcon(t)} {tipoLabel(t)}
              </button>
            )
          )}
        </div>

        {/* Grid de cards */}
        {data.items.length === 0 ? (
          <div className="text-center py-10 text-fysi-muted text-sm border-2 border-dashed border-fysi-line rounded-[16px]">
            Nenhum card ainda. Use os botões acima pra adicionar.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.items.map((item, idx) => (
              <CardEditor
                key={item.id}
                item={item}
                isFirst={idx === 0}
                isLast={idx === data.items.length - 1}
                onUpdate={(p) => updateItem(item.id, p)}
                onRemove={() => removeItem(item.id)}
                onMove={(d) => moveItem(item.id, d)}
                onComment={(txt) => addAdminComment(item.id, txt)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CardEditor({
  item,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMove,
  onComment,
}: {
  item: MoodboardItem;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (p: Partial<MoodboardItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onComment: (texto: string) => void;
}) {
  const [comentTexto, setComentTexto] = useState("");

  function commit() {
    if (comentTexto.trim()) {
      onComment(comentTexto.trim());
      setComentTexto("");
    }
  }

  return (
    <div className="rounded-[14px] border border-fysi-line bg-fysi-cream/20 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-fysi-muted font-medium">
          {tipoIcon(item.tipo)} {tipoLabel(item.tipo)}
        </span>
        <span
          className="text-xs"
          title={
            item.status === "aprovado"
              ? "Aprovado pelo cliente"
              : item.status === "rejeitado"
                ? "Rejeitado pelo cliente"
                : "Aguardando avaliação"
          }
        >
          {itemStatusEmoji(item.status)}
        </span>
      </div>

      <Input
        value={item.titulo}
        onChange={(e) => onUpdate({ titulo: e.target.value })}
        placeholder="Título"
      />

      {/* Conteúdo varia por tipo */}
      {item.tipo === "imagem" ? (
        <div className="flex flex-col gap-2">
          <Input
            value={item.conteudo}
            onChange={(e) => onUpdate({ conteudo: e.target.value })}
            placeholder="URL da imagem (https://...)"
          />
          {item.conteudo ? (
            <div className="aspect-video rounded-[10px] overflow-hidden bg-white border border-fysi-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.conteudo}
                alt={item.titulo || "Preview"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>
      ) : item.tipo === "link" ? (
        <Input
          value={item.conteudo}
          onChange={(e) => onUpdate({ conteudo: e.target.value })}
          placeholder="https://behance.net/..."
        />
      ) : item.tipo === "cor" ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={item.conteudo || "#042B30"}
            onChange={(e) => onUpdate({ conteudo: e.target.value })}
            className="h-10 w-14 rounded-md border border-fysi-line cursor-pointer"
          />
          <Input
            value={item.conteudo}
            onChange={(e) => onUpdate({ conteudo: e.target.value })}
            placeholder="#042B30"
          />
        </div>
      ) : (
        <Textarea
          rows={3}
          value={item.conteudo}
          onChange={(e) => onUpdate({ conteudo: e.target.value })}
          placeholder="Texto livre — observação, direção..."
        />
      )}

      <Textarea
        rows={2}
        value={item.notas}
        onChange={(e) => onUpdate({ notas: e.target.value })}
        placeholder="Notas internas (não visível pro cliente)"
      />

      {/* Comentários */}
      {item.comentarios.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-fysi-line pt-2">
          <p className="text-[0.6rem] uppercase tracking-[0.1em] text-fysi-muted font-medium">
            Comentários ({item.comentarios.length})
          </p>
          {item.comentarios.slice(-3).map((c) => (
            <div
              key={c.id}
              className="text-xs bg-white border border-fysi-line rounded-md px-2 py-1"
            >
              <span className="font-medium text-fysi-deep">
                {c.autor === "admin" ? "Equipe" : "Cliente"}:
              </span>{" "}
              <span className="text-fysi-deep/80">{c.texto}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-1 mt-1">
        <input
          type="text"
          value={comentTexto}
          onChange={(e) => setComentTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          placeholder="Add comentário..."
          className="flex-1 text-xs rounded-md border border-fysi-line bg-white px-2 py-1 focus:outline-none focus:border-fysi-deep/40"
        />
        <button
          type="button"
          onClick={commit}
          className="text-xs text-fysi-deep hover:underline font-medium px-1"
        >
          +
        </button>
      </div>

      <div className="flex items-center justify-between gap-1 pt-2 border-t border-fysi-line">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="text-xs text-fysi-muted hover:text-fysi-deep disabled:opacity-30 px-1"
            aria-label="Mover pra cima"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="text-xs text-fysi-muted hover:text-fysi-deep disabled:opacity-30 px-1"
            aria-label="Mover pra baixo"
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-600 hover:text-red-800"
          aria-label="Remover card"
        >
          ✕ remover
        </button>
      </div>
    </div>
  );
}

function tipoIcon(t: MoodboardItemTipo): string {
  return t === "imagem" ? "🖼️" : t === "link" ? "🔗" : t === "cor" ? "🎨" : "📝";
}

function tipoLabel(t: MoodboardItemTipo): string {
  return t === "imagem"
    ? "Imagem"
    : t === "link"
      ? "Link"
      : t === "cor"
        ? "Cor"
        : "Nota";
}
