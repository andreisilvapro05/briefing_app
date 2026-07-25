"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  seedDefaultColumnsAction,
  addColumnAction,
  renameColumnAction,
  deleteColumnAction,
  moveColumnAction,
  addCardAction,
  updateCardAction,
  moveCardAction,
  deleteCardAction,
  setCardImagesAction,
} from "@/app/admin/conteudo/actions";
import type { ContentCard, ContentColumn } from "@/lib/content-board";

/**
 * Quadro de produção de conteúdo (kanban único da Fysi). Estado local otimista;
 * ações persistem em background. Clicar num cartão abre um modal estilo Trello
 * (título + descrição + mover + excluir). Mover é por menu (sem drag-drop).
 */
export function ContentBoard({
  initialColumns,
  urlKey,
}: {
  initialColumns: ContentColumn[];
  urlKey?: string;
}) {
  const [columns, setColumns] = useState<ContentColumn[]>(initialColumns);
  const [newColName, setNewColName] = useState("");
  const [addingCol, setAddingCol] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function fd(extra: Record<string, string>) {
    const f = new FormData();
    if (urlKey) f.append("key", urlKey);
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  }

  const totalCards = columns.reduce((n, c) => n + c.cards.length, 0);
  const openCard = openCardId
    ? columns.flatMap((c) => c.cards).find((x) => x.id === openCardId) ?? null
    : null;

  function seed() {
    startTransition(async () => {
      const cols = await seedDefaultColumnsAction(fd({}));
      if (cols.length) setColumns(cols.map((c) => ({ ...c, cards: [] })));
    });
  }

  function addColumn() {
    const titulo = newColName.trim();
    if (!titulo) return;
    setNewColName("");
    setAddingCol(false);
    startTransition(async () => {
      const col = await addColumnAction(fd({ titulo }));
      if (col) setColumns((prev) => [...prev, { ...col, cards: [] }]);
    });
  }

  function renameColumn(id: string, titulo: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, titulo } : c)));
    startTransition(() => {
      renameColumnAction(fd({ columnId: id, titulo }));
    });
  }

  function deleteColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id));
    startTransition(() => {
      deleteColumnAction(fd({ columnId: id }));
    });
  }

  function moveColumn(id: string, direction: "left" | "right") {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const swap = direction === "left" ? idx - 1 : idx + 1;
      if (idx === -1 || swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    startTransition(() => {
      moveColumnAction(fd({ columnId: id, direction }));
    });
  }

  function addCard(columnId: string, titulo: string) {
    startTransition(async () => {
      const res = await addCardAction(fd({ columnId, titulo }));
      if (res) {
        setColumns((prev) =>
          prev.map((c) =>
            c.id === columnId
              ? {
                  ...c,
                  cards: [
                    ...c.cards,
                    {
                      id: res.id,
                      column_id: columnId,
                      titulo,
                      descricao: null,
                      ordem: c.cards.length,
                      imagens: [],
                    },
                  ],
                }
              : c
          )
        );
      }
    });
  }

  function updateCard(cardId: string, titulo: string, descricao: string) {
    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.map((card) =>
          card.id === cardId
            ? { ...card, titulo, descricao: descricao || null }
            : card
        ),
      }))
    );
    startTransition(() => {
      updateCardAction(fd({ cardId, titulo, descricao }));
    });
  }

  function moveCard(cardId: string, targetColumnId: string) {
    setColumns((prev) => {
      let moved: ContentCard | undefined;
      const stripped = prev.map((c) => {
        const found = c.cards.find((x) => x.id === cardId);
        if (found) {
          moved = found;
          return { ...c, cards: c.cards.filter((x) => x.id !== cardId) };
        }
        return c;
      });
      if (!moved) return prev;
      const card = moved;
      return stripped.map((c) =>
        c.id === targetColumnId
          ? { ...c, cards: [...c.cards, { ...card, column_id: targetColumnId }] }
          : c
      );
    });
    startTransition(() => {
      moveCardAction(fd({ cardId, targetColumnId }));
    });
  }

  function deleteCard(cardId: string) {
    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.filter((x) => x.id !== cardId),
      }))
    );
    startTransition(() => {
      deleteCardAction(fd({ cardId }));
    });
  }

  function updateCardImages(cardId: string, imagens: string[]) {
    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        cards: c.cards.map((card) =>
          card.id === cardId ? { ...card, imagens } : card
        ),
      }))
    );
    startTransition(() => {
      setCardImagesAction(fd({ cardId, imagens: JSON.stringify(imagens) }));
    });
  }

  // Faz upload de uma imagem e devolve a URL pública (ou null se falhar).
  async function uploadImage(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    const q = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
    try {
      const res = await fetch(`/api/admin/conteudo/upload${q}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data?.url ?? null;
    } catch {
      return null;
    }
  }

  if (columns.length === 0) {
    return (
      <div className="bg-white border border-fysi-line rounded-[20px] p-10 text-center">
        <p className="text-fysi-deep font-medium">Quadro vazio</p>
        <p className="text-sm text-fysi-muted mt-1 mb-5">
          Crie as colunas do seu fluxo de conteúdo — ou comece com um modelo
          pronto.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={seed}>
            Criar colunas de exemplo
          </Button>
          <div className="flex gap-2">
            <input
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addColumn()}
              placeholder="Nome da coluna…"
              className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addColumn}
              disabled={!newColName.trim()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-3 mb-3 text-xs text-fysi-muted">
        <span>
          {columns.length} coluna{columns.length === 1 ? "" : "s"} ·{" "}
          {totalCards} {totalCards === 1 ? "cartão" : "cartões"}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto kanban-scroll pb-3 items-start">
        {columns.map((col, i) => (
          <ColumnPanel
            key={col.id}
            column={col}
            index={i}
            total={columns.length}
            onRename={renameColumn}
            onDelete={deleteColumn}
            onMoveColumn={moveColumn}
            onAddCard={addCard}
            onOpenCard={setOpenCardId}
          />
        ))}

        {/* Nova coluna */}
        <div className="w-[300px] shrink-0">
          {addingCol ? (
            <div className="bg-white border border-fysi-line rounded-[14px] p-3 flex flex-col gap-2">
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addColumn()}
                placeholder="Nome da coluna…"
                className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={addColumn}
                  disabled={!newColName.trim()}
                >
                  Adicionar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingCol(false);
                    setNewColName("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCol(true)}
              className="w-full text-left rounded-[14px] border border-dashed border-fysi-line-strong text-fysi-muted hover:text-fysi-deep hover:border-fysi-deep/40 px-4 py-3 text-sm font-medium transition"
            >
              + Nova coluna
            </button>
          )}
        </div>
      </div>

      {openCard ? (
        <CardModal
          card={openCard}
          columns={columns}
          onClose={() => setOpenCardId(null)}
          onUpdate={updateCard}
          onMove={(cardId, target) => {
            moveCard(cardId, target);
          }}
          onDelete={(cardId) => {
            deleteCard(cardId);
            setOpenCardId(null);
          }}
          onUpdateImages={updateCardImages}
          onUploadImage={uploadImage}
        />
      ) : null}
    </div>
  );
}

function ColumnPanel({
  column,
  index,
  total,
  onRename,
  onDelete,
  onMoveColumn,
  onAddCard,
  onOpenCard,
}: {
  column: ContentColumn;
  index: number;
  total: number;
  onRename: (id: string, titulo: string) => void;
  onDelete: (id: string) => void;
  onMoveColumn: (id: string, dir: "left" | "right") => void;
  onAddCard: (columnId: string, titulo: string) => void;
  onOpenCard: (cardId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(column.titulo);
  const [adding, setAdding] = useState(false);
  const [cardTitle, setCardTitle] = useState("");

  function submitAdd() {
    const t = cardTitle.trim();
    if (!t) return;
    onAddCard(column.id, t);
    setCardTitle("");
  }

  return (
    <div className="w-[300px] shrink-0 bg-fysi-cream/70 border border-fysi-line rounded-[14px] p-2.5 flex flex-col gap-2 min-h-[62vh] max-h-[calc(100vh-13rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={() => {
              if (renameVal.trim()) onRename(column.id, renameVal.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (renameVal.trim()) onRename(column.id, renameVal.trim());
                setRenaming(false);
              }
              if (e.key === "Escape") {
                setRenameVal(column.titulo);
                setRenaming(false);
              }
            }}
            className="flex-1 min-w-0 rounded-[8px] border border-fysi-line bg-white px-2 py-1 text-sm font-semibold text-fysi-deep"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setRenameVal(column.titulo);
              setRenaming(true);
            }}
            className="flex-1 min-w-0 text-left text-sm font-semibold text-fysi-deep truncate"
            title="Renomear coluna"
          >
            {column.titulo}
          </button>
        )}
        <span className="text-[0.7rem] text-fysi-muted shrink-0 tabular-nums">
          {column.cards.length}
        </span>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-6 h-6 grid place-items-center rounded-md text-fysi-muted hover:bg-fysi-deep/5 hover:text-fysi-deep"
            title="Opções da coluna"
          >
            ⋯
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-7 z-10 w-44 bg-white border border-fysi-line rounded-[12px] shadow-lg p-1 text-sm"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <MenuItem
                disabled={index === 0}
                onClick={() => {
                  onMoveColumn(column.id, "left");
                  setMenuOpen(false);
                }}
              >
                ← Mover pra esquerda
              </MenuItem>
              <MenuItem
                disabled={index === total - 1}
                onClick={() => {
                  onMoveColumn(column.id, "right");
                  setMenuOpen(false);
                }}
              >
                Mover pra direita →
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setRenameVal(column.titulo);
                  setRenaming(true);
                  setMenuOpen(false);
                }}
              >
                Renomear
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  if (
                    column.cards.length === 0 ||
                    window.confirm(
                      `Excluir "${column.titulo}" e seus ${column.cards.length} cartões?`
                    )
                  ) {
                    onDelete(column.id);
                  }
                  setMenuOpen(false);
                }}
              >
                Excluir coluna
              </MenuItem>
            </div>
          ) : null}
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto kanban-scroll px-0.5 flex-1">
        {column.cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onOpenCard(card.id)}
            className="group text-left bg-white border border-fysi-line rounded-[12px] p-2.5 hover:border-fysi-deep/40 hover:shadow-sm transition"
          >
            {card.imagens?.length ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imagens[0]}
                alt=""
                className="w-full h-28 object-cover rounded-[8px] mb-2"
              />
            ) : null}
            <p className="text-sm text-fysi-deep font-medium leading-snug whitespace-pre-wrap">
              {card.titulo}
            </p>
            {card.descricao ? (
              <p className="text-xs text-fysi-muted mt-1 whitespace-pre-wrap line-clamp-2">
                {card.descricao}
              </p>
            ) : null}
          </button>
        ))}
      </div>

      {/* Add card */}
      {adding ? (
        <div className="flex flex-col gap-2 px-0.5 pb-0.5">
          <textarea
            autoFocus
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitAdd();
              }
            }}
            rows={2}
            placeholder="Título do cartão…"
            className="rounded-[10px] border border-fysi-line bg-white px-3 py-2 text-sm text-fysi-deep resize-none"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={submitAdd}
              disabled={!cardTitle.trim()}
            >
              Adicionar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setCardTitle("");
              }}
            >
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-left text-sm text-fysi-muted hover:text-fysi-deep px-2 py-1.5 rounded-[8px] hover:bg-fysi-deep/[0.04] transition"
        >
          + Adicionar cartão
        </button>
      )}
    </div>
  );
}

/** Modal estilo Trello: título editável + descrição + mover + excluir. */
function CardModal({
  card,
  columns,
  onClose,
  onUpdate,
  onMove,
  onDelete,
  onUpdateImages,
  onUploadImage,
}: {
  card: ContentCard;
  columns: ContentColumn[];
  onClose: () => void;
  onUpdate: (cardId: string, titulo: string, descricao: string) => void;
  onMove: (cardId: string, targetColumnId: string) => void;
  onDelete: (cardId: string) => void;
  onUpdateImages: (cardId: string, imagens: string[]) => void;
  onUploadImage: (file: File) => Promise<string | null>;
}) {
  const [titulo, setTitulo] = useState(card.titulo);
  const [descricao, setDescricao] = useState(card.descricao ?? "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const imagens = card.imagens ?? [];

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadErr(null);
    setUploading(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const url = await onUploadImage(file);
      if (url) added.push(url);
    }
    setUploading(false);
    if (added.length) {
      onUpdateImages(card.id, [...imagens, ...added]);
    } else {
      setUploadErr("Não consegui subir a imagem. Tenta de novo.");
    }
  }

  function removeImage(url: string) {
    onUpdateImages(
      card.id,
      imagens.filter((u) => u !== url)
    );
  }

  const column = columns.find((c) => c.id === card.column_id);
  const others = columns.filter((c) => c.id !== card.column_id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    if (!titulo.trim()) return;
    onUpdate(card.id, titulo.trim(), descricao.trim());
    setDirty(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-fysi-deep/40 backdrop-blur-sm flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-[18px] shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-fysi-line">
          <span className="inline-flex items-center gap-2 rounded-full bg-fysi-cream border border-fysi-line px-3 py-1 text-xs font-medium text-fysi-deep">
            {column?.titulo ?? "Coluna"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg text-fysi-muted hover:bg-fysi-cream hover:text-fysi-deep"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-5">
          <div>
            <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
              Título
            </label>
            <input
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                setDirty(true);
              }}
              className="mt-1 w-full text-lg font-semibold text-fysi-deep bg-transparent border border-transparent hover:border-fysi-line focus:border-fysi-deep/40 rounded-[10px] px-2 py-1.5 -ml-2 focus:outline-none transition"
              placeholder="Título do cartão"
            />
          </div>

          <div>
            <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                setDirty(true);
              }}
              rows={7}
              placeholder="Adicione uma descrição mais detalhada… (briefing, roteiro, links, referências)"
              className="mt-1 w-full text-sm text-fysi-deep bg-fysi-cream/40 border border-fysi-line rounded-[12px] px-3 py-2.5 focus:outline-none focus:border-fysi-deep/40 resize-y"
            />
          </div>

          {/* Imagens */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[0.7rem] uppercase tracking-[0.12em] text-fysi-muted font-semibold">
                Imagens
              </label>
              <label className="text-xs font-medium text-fysi-deep hover:text-fysi-green cursor-pointer">
                {uploading ? "Enviando…" : "+ Adicionar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploadErr ? (
              <p className="text-xs text-red-600 mt-1">{uploadErr}</p>
            ) : null}
            {imagens.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {imagens.map((url) => (
                  <div
                    key={url}
                    className="relative group rounded-[10px] overflow-hidden border border-fysi-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt=""
                        className="w-full h-24 object-cover"
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-full bg-white/90 text-fysi-deep text-xs shadow hover:bg-white"
                      title="Remover imagem"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fysi-muted/70 mt-1">
                Nenhuma imagem. Adicione referências, prints ou artes.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-fysi-muted">
              Mover para
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onMove(card.id, e.target.value);
                }}
                disabled={others.length === 0}
                className="border border-fysi-line rounded-[10px] px-3 py-1.5 bg-white text-sm text-fysi-deep disabled:opacity-40"
              >
                <option value="">Escolher coluna…</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="text-sm text-red-700 hover:underline"
            >
              Excluir cartão
            </button>
          </div>

          <p className="text-[0.68rem] text-fysi-muted/80">
            Em breve: etiquetas, datas, checklist e comentários.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-fysi-line">
          {saved ? (
            <span className="text-xs text-fysi-green font-medium mr-auto">
              Salvo ✓
            </span>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || !titulo.trim()}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-2.5 py-1.5 rounded-[8px] transition disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? "text-red-700 hover:bg-red-50"
          : "text-fysi-deep hover:bg-fysi-cream"
      }`}
    >
      {children}
    </button>
  );
}
