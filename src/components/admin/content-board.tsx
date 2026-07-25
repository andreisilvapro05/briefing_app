"use client";

import { useState, useTransition } from "react";
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
} from "@/app/admin/conteudo/actions";
import type { ContentCard, ContentColumn } from "@/lib/content-board";

/**
 * Quadro de produção de conteúdo (kanban único da Fysi). Estado local é a
 * fonte da verdade durante a sessão (atualizações otimistas); as ações
 * persistem no banco em background. Mover cartões é por menu (sem drag-drop).
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
  const [, startTransition] = useTransition();

  function fd(extra: Record<string, string>) {
    const f = new FormData();
    if (urlKey) f.append("key", urlKey);
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  }

  const totalCards = columns.reduce((n, c) => n + c.cards.length, 0);

  function seed() {
    startTransition(async () => {
      const cols = await seedDefaultColumnsAction(fd({}));
      if (cols.length) {
        setColumns(cols.map((c) => ({ ...c, cards: [] })));
      }
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
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, titulo } : c))
    );
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
    <div>
      <div className="flex items-center gap-3 mb-4 text-xs text-fysi-muted">
        <span>
          {columns.length} coluna{columns.length === 1 ? "" : "s"} ·{" "}
          {totalCards} {totalCards === 1 ? "cartão" : "cartões"}
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {columns.map((col, i) => (
          <ColumnPanel
            key={col.id}
            column={col}
            index={i}
            total={columns.length}
            allColumns={columns}
            onRename={renameColumn}
            onDelete={deleteColumn}
            onMoveColumn={moveColumn}
            onAddCard={addCard}
            onUpdateCard={updateCard}
            onMoveCard={moveCard}
            onDeleteCard={deleteCard}
          />
        ))}

        {/* Nova coluna */}
        <div className="w-[280px] shrink-0">
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
    </div>
  );
}

function ColumnPanel({
  column,
  index,
  total,
  allColumns,
  onRename,
  onDelete,
  onMoveColumn,
  onAddCard,
  onUpdateCard,
  onMoveCard,
  onDeleteCard,
}: {
  column: ContentColumn;
  index: number;
  total: number;
  allColumns: ContentColumn[];
  onRename: (id: string, titulo: string) => void;
  onDelete: (id: string) => void;
  onMoveColumn: (id: string, dir: "left" | "right") => void;
  onAddCard: (columnId: string, titulo: string) => void;
  onUpdateCard: (cardId: string, titulo: string, descricao: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string) => void;
  onDeleteCard: (cardId: string) => void;
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
    // mantém aberto pra adicionar vários em sequência
  }

  return (
    <div className="w-[280px] shrink-0 bg-fysi-cream/60 border border-fysi-line rounded-[14px] p-2.5 flex flex-col gap-2 max-h-[calc(100vh-220px)]">
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
        <span className="text-[0.7rem] text-fysi-muted shrink-0">
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
      <div className="flex flex-col gap-2 overflow-y-auto px-0.5">
        {column.cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            allColumns={allColumns}
            onUpdate={onUpdateCard}
            onMove={onMoveCard}
            onDelete={onDeleteCard}
          />
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

function CardItem({
  card,
  allColumns,
  onUpdate,
  onMove,
  onDelete,
}: {
  card: ContentCard;
  allColumns: ContentColumn[];
  onUpdate: (cardId: string, titulo: string, descricao: string) => void;
  onMove: (cardId: string, targetColumnId: string) => void;
  onDelete: (cardId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(card.titulo);
  const [descricao, setDescricao] = useState(card.descricao ?? "");

  const otherColumns = allColumns.filter((c) => c.id !== card.column_id);

  if (editing) {
    return (
      <div className="bg-white border border-fysi-mint-vivid rounded-[12px] p-2.5 flex flex-col gap-2">
        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="rounded-[8px] border border-fysi-line bg-white px-2 py-1.5 text-sm font-medium text-fysi-deep"
          placeholder="Título"
        />
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          className="rounded-[8px] border border-fysi-line bg-white px-2 py-1.5 text-xs text-fysi-deep resize-none"
          placeholder="Descrição (opcional)"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (titulo.trim()) {
                onUpdate(card.id, titulo.trim(), descricao.trim());
                setEditing(false);
              }
            }}
            disabled={!titulo.trim()}
          >
            Salvar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setTitulo(card.titulo);
              setDescricao(card.descricao ?? "");
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group bg-white border border-fysi-line rounded-[12px] p-2.5 hover:border-fysi-deep/40 hover:shadow-sm transition relative cursor-pointer"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") setEditing(true);
      }}
      title="Abrir cartão"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-fysi-deep font-medium leading-snug whitespace-pre-wrap min-w-0">
          {card.titulo}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="shrink-0 w-7 h-7 grid place-items-center rounded-md text-fysi-muted hover:bg-fysi-deep/5 hover:text-fysi-deep"
          title="Opções do cartão"
        >
          ⋯
        </button>
      </div>
      {card.descricao ? (
        <p className="text-xs text-fysi-muted mt-1 whitespace-pre-wrap line-clamp-3">
          {card.descricao}
        </p>
      ) : (
        <p className="text-xs text-fysi-muted/70 mt-1 italic">
          Clique pra abrir e editar
        </p>
      )}

      {menuOpen ? (
        <div
          className="absolute right-2 top-9 z-10 w-52 bg-white border border-fysi-line rounded-[12px] shadow-lg p-1 text-sm"
          onClick={(e) => e.stopPropagation()}
          onMouseLeave={() => setMenuOpen(false)}
        >
          <MenuItem
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
          >
            Editar
          </MenuItem>
          {otherColumns.length > 0 ? (
            <>
              <p className="px-2.5 pt-2 pb-1 text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted">
                Mover para
              </p>
              {otherColumns.map((c) => (
                <MenuItem
                  key={c.id}
                  onClick={() => {
                    onMove(card.id, c.id);
                    setMenuOpen(false);
                  }}
                >
                  → {c.titulo}
                </MenuItem>
              ))}
            </>
          ) : null}
          <MenuItem
            danger
            onClick={() => {
              onDelete(card.id);
              setMenuOpen(false);
            }}
          >
            Excluir
          </MenuItem>
        </div>
      ) : null}
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
