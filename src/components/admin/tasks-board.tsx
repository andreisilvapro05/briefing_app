"use client";

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  seedProjectTasksAction,
  removeProjectTaskAction,
  updateProjectTaskAction,
  reorderProjectTasksAction,
} from "@/app/admin/[id]/actions";
import {
  esforcoDe,
  quadranteDe,
  TASK_STATUS_OPTIONS,
  TASK_STATUS_TONE,
  TASK_STATUS_GROUP,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/project-tasks";
import type { ProjectType } from "@/lib/types";
import {
  AssigneePicker,
  DueDatePicker,
  PriorityPicker,
  hojeISO,
} from "./task-pickers";
import { TaskComposer } from "./task-composer";
import { TarefaCard, type CampoDaTarefa } from "./tarefa-card";

/** Data (YYYY-MM-DD) já passou e a tarefa não está num status "fechado". */
function isOverdue(dataVencimento: string, status: TaskStatus): boolean {
  if (!dataVencimento) return false;
  if (TASK_STATUS_GROUP[status] === "fechado") return false;
  return dataVencimento < hojeISO();
}

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
      <circle cx="2.5" cy="2.5" r="1.4" />
      <circle cx="7.5" cy="2.5" r="1.4" />
      <circle cx="2.5" cy="8" r="1.4" />
      <circle cx="7.5" cy="8" r="1.4" />
      <circle cx="2.5" cy="13.5" r="1.4" />
      <circle cx="7.5" cy="13.5" r="1.4" />
    </svg>
  );
}

/**
 * Larguras de coluna, guardadas por viewer no localStorage (uma chave por
 * tabela: Tarefas do cliente, Tarefas de todos os projetos e o accordion da
 * pizza têm colunas diferentes).
 *
 * `useSyncExternalStore` em vez de `useState` + efeito: o valor salvo só
 * existe no navegador. Lê-lo durante o render quebraria a hidratação, e
 * lê-lo num efeito com setState dispara um segundo render em toda tabela da
 * tela. Aqui o servidor devolve o padrão e o navegador devolve o salvo, que
 * é exatamente o contrato dessa API.
 *
 * O cache por chave existe porque `getSnapshot` precisa devolver a MESMA
 * referência enquanto nada mudar — devolver um array novo a cada chamada
 * põe o React em laço infinito.
 */
const larguraOuvintes = new Set<() => void>();
const larguraCache = new Map<string, number[]>();

function lerLarguraSalva(chave: string, n: number): number[] | null {
  try {
    const raw = localStorage.getItem(chave);
    if (!raw) return null;
    const p: unknown = JSON.parse(raw);
    if (
      Array.isArray(p) &&
      p.length === n &&
      p.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 48)
    ) {
      return p as number[];
    }
  } catch {
    /* localStorage bloqueado ou JSON corrompido: fica no padrão. */
  }
  return null;
}

function larguraAtual(chave: string, padrao: number[]): number[] {
  const emCache = larguraCache.get(chave);
  if (emCache && emCache.length === padrao.length) return emCache;
  const valor = lerLarguraSalva(chave, padrao.length) ?? padrao;
  larguraCache.set(chave, valor);
  return valor;
}

export function useColumnWidths(storageKey: string, defaults: number[]) {
  // Fixa a referência do padrão na primeira montagem: quem chama passa um
  // array literal, que seria novo a cada render.
  const padraoRef = useRef(defaults);

  const subscribe = useCallback((cb: () => void) => {
    larguraOuvintes.add(cb);
    return () => {
      larguraOuvintes.delete(cb);
    };
  }, []);
  const getSnapshot = useCallback(
    () => larguraAtual(storageKey, padraoRef.current),
    [storageKey]
  );
  const getServerSnapshot = useCallback(() => padraoRef.current, []);

  const widths = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function startResize(index: number) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const inicioX = e.clientX;
      const larguraInicial = larguraAtual(storageKey, padraoRef.current)[index];

      function aplicar(proximas: number[]) {
        larguraCache.set(storageKey, proximas);
        for (const ouvinte of larguraOuvintes) ouvinte();
      }
      function onMove(ev: MouseEvent) {
        const proximas = larguraAtual(storageKey, padraoRef.current).slice();
        proximas[index] = Math.max(48, larguraInicial + (ev.clientX - inicioX));
        aplicar(proximas);
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify(larguraAtual(storageKey, padraoRef.current))
          );
        } catch {
          /* sem localStorage a largura vale só nesta sessão. */
        }
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  const total = widths.reduce((s, w) => s + w, 0);
  return { widths, total, startResize };
}

export function ColGroup({ widths }: { widths: number[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

/** Cabeçalho de coluna com a alça de redimensionar na borda direita. */
export function ResizableTh({
  children,
  onResizeStart,
  className = "",
  title,
}: {
  children?: ReactNode;
  onResizeStart?: (e: React.MouseEvent) => void;
  className?: string;
  /** Nome por extenso quando o rótulo da coluna é abreviado. */
  title?: string;
}) {
  return (
    <th title={title} className={`relative px-3 py-2 font-medium ${className}`}>
      <span className="truncate block pr-2">{children}</span>
      {onResizeStart ? (
        <span
          onMouseDown={onResizeStart}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-fysi-deep/15 active:bg-fysi-deep/25 select-none"
        />
      ) : null}
    </th>
  );
}

/**
 * Ação secundária da linha (renomear, remover): aparece no hover ou no foco
 * do teclado. Em tela de toque não existe hover, então fica sempre visível.
 */
const HOVER_ONLY =
  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

interface DragHandlers {
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isOver: boolean;
}

/**
 * Reordenação por arrastar-e-soltar (igual ClickUp) — mantém uma cópia local
 * ordenada pra feedback instantâneo e escreve no banco via
 * reorderProjectTasksAction ao soltar. Um hook por lista (cada accordion de
 * cliente na pizza tem a sua, independente das outras).
 */
export function useTaskDrag(
  tasks: ProjectTask[],
  clientId: string,
  urlKey?: string
) {
  const router = useRouter();
  // Ordem otimista do último arrasto, válida só enquanto o servidor ainda
  // devolve a ordem em que o arrasto foi feito (`baseKey`). Quando o refresh
  // traz a ordem nova, ela deixa de valer sozinha.
  //
  // Antes isso era `useState(tasks)` + `useEffect(() => setOrder(tasks),
  // [tasks])`. Quem chama passa um array NOVO a cada render (`tasks.filter()`,
  // `carregadas ?? []`), então o efeito disparava em todo render, o setState
  // gerava outro render, e a lista ficava em loop infinito de renderização —
  // um por cliente na Lista/Visão Geral, mesmo com o accordion fechado.
  const [optimistic, setOptimistic] = useState<{
    ids: string[];
    baseKey: string;
  } | null>(null);
  const serverKey = tasks.map((t) => t.id).join(",");
  // Derivado a cada render, sem estado nem efeito: os objetos vêm sempre de
  // `tasks`, então status/datas recém-salvos aparecem mesmo com a ordem
  // otimista ativa.
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const order =
    optimistic && optimistic.baseKey === serverKey
      ? optimistic.ids.flatMap((id) => byId.get(id) ?? [])
      : tasks;
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [erroOrdem, setErroOrdem] = useState<string | null>(null);

  function dragProps(t: ProjectTask): DragHandlers {
    return {
      onDragStart: () => setDragId(t.id),
      onDragOver: (e) => {
        e.preventDefault();
        if (dragId && overId !== t.id) setOverId(t.id);
      },
      onDrop: () => {
        const from = order.findIndex((x) => x.id === dragId);
        const to = order.findIndex((x) => x.id === t.id);
        setDragId(null);
        setOverId(null);
        if (from === -1 || to === -1 || from === to) return;

        const next = order.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setOptimistic({ ids: next.map((x) => x.id), baseKey: serverKey });

        const fd = new FormData();
        fd.append("clientId", clientId);
        if (urlKey) fd.append("key", urlKey);
        next.forEach((x) => fd.append("taskId", x.id));
        // Se o servidor recusar (ex: "basico" tentando reordenar tarefa que
        // não é dele), reverte a ordem otimista em vez de deixar a UI mentir.
        // A recusa volta como { ok: false }, não como exceção — só o
        // `.catch` deixava a lista mentindo pelo resto da sessão.
        reorderProjectTasksAction(fd)
          .then((r) => {
            if (!r.ok) {
              setOptimistic(null);
              setErroOrdem(r.erro);
              return;
            }
            setErroOrdem(null);
            router.refresh();
          })
          .catch(() => {
            setOptimistic(null);
            setErroOrdem("Não consegui salvar a ordem. Confira a conexão.");
          });
      },
      onDragEnd: () => {
        setDragId(null);
        setOverId(null);
      },
      isDragging: dragId === t.id,
      isOver: overId === t.id && !!dragId && dragId !== t.id,
    };
  }

  return { order, dragProps, erroOrdem };
}

export function TaskRow({
  task,
  clientId,
  urlKey,
  clienteCell,
  drag,
  readOnly,
  onListaMudou,
}: {
  task: ProjectTask;
  clientId: string;
  urlKey?: string;
  /** Célula extra no início da linha (link pro cliente) — só a visão consolidada de /admin/tarefas usa. */
  clienteCell?: ReactNode;
  /** Handlers de drag-and-drop — só faz sentido dentro da lista de um único cliente (ver useTaskDrag). */
  drag?: DragHandlers;
  /** Papel "basico" só vê (não edita) tarefa de outra pessoa — server já rejeita, isso só reflete na UI. */
  readOnly?: boolean;
  /**
   * A lista do servidor mudou por dentro desta tarefa (nasceu uma tarefa
   * abaixo, entrou ou saiu um anexo) — pra tela que guarda as tarefas em
   * estado local e não as relê a cada render; ver o accordion da Lista.
   */
  onListaMudou?: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [prioridade, setPrioridade] = useState(task.prioridade ?? "");
  const [responsavel, setResponsavel] = useState(task.responsavel ?? "");
  const [dataInicial, setDataInicial] = useState(task.data_inicial ?? "");
  const [dataVencimento, setDataVencimento] = useState(
    task.data_vencimento ?? ""
  );
  const [observacoes, setObservacoes] = useState(task.observacoes ?? "");
  const [eisenhower, setEisenhower] = useState(task.eisenhower ?? "");
  const [esforco, setEsforco] = useState(task.esforco ?? "");
  const [titulo, setTitulo] = useState(task.titulo);
  const [renomeando, setRenomeando] = useState(false);
  /**
   * A tarefa aberta como CARTÃO em cima da tela (Karine, 04/10: "ele abre
   * como card na tela, pop up"). Substituiu a linha que se abria embaixo da
   * tarefa — ver tarefa-card.tsx.
   */
  const [cardAberto, setCardAberto] = useState(false);
  /** O botão do nome, pra devolver o foco pra ele quando o cartão fecha. */
  const tituloBotaoRef = useRef<HTMLButtonElement>(null);
  /**
   * Barra de criar tarefa LOGO ABAIXO desta — o "+" que aparece ao passar
   * o mouse (Karine, 01/10: "ao passar o mouse pela tarefa ou subtarefa
   * ter um + para adicionar uma tarefa"). A posição é calculada no
   * servidor a partir de `depoisDe`; ver src/lib/ordem-tarefas.ts.
   */
  const [criandoAbaixo, setCriandoAbaixo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Grava o nome se mudou. Serve aos dois lugares que editam o mesmo
   * estado: o lápis da linha e o título grande do cartão.
   */
  function confirmarTitulo() {
    const novo = titulo.trim();
    // Vazio ou igual: volta ao que estava, sem ir ao servidor.
    if (!novo || novo === task.titulo) {
      setTitulo(task.titulo);
      return;
    }
    setTitulo(novo);
    saveField("titulo", novo, () => setTitulo(task.titulo));
  }

  function salvarTitulo() {
    setRenomeando(false);
    confirmarTitulo();
  }

  function baseFd() {
    const fd = new FormData();
    fd.append("taskId", task.id);
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    return fd;
  }

  /**
   * Grava um campo. `reverter` desfaz o estado local quando o servidor
   * recusa — sem isso a tela ficava mostrando o valor novo de um campo que
   * não salvou, e quem editou só descobria no próximo carregamento.
   */
  function saveField(field: string, value: string, reverter?: () => void) {
    const fd = baseFd();
    fd.append(field, value);
    setErroSalvar(null);
    startTransition(async () => {
      try {
        const r = await updateProjectTaskAction(fd);
        if (!r.ok) {
          reverter?.();
          setErroSalvar(r.erro);
          return;
        }
      } catch {
        reverter?.();
        setErroSalvar("Não consegui salvar. Confira a conexão.");
        return;
      }
      router.refresh();
    });
  }

  /**
   * Embala um campo pro cartão: grava otimista e DESFAZ o estado local se o
   * servidor recusar. É o mesmo par setX/reverter que cada célula da linha
   * repetia à mão — agora num só lugar, e o cartão não precisa conhecer
   * `saveField`.
   */
  function campo<T extends string>(
    nome: string,
    valor: T,
    setValor: (v: T) => void
  ): CampoDaTarefa<T> {
    return {
      valor,
      definir: (v) => {
        const anterior = valor;
        setValor(v);
        saveField(nome, v, () => setValor(anterior));
      },
    };
  }

  /** Descrição (observacoes): digita livre, grava ao sair do campo. */
  function confirmarDescricao() {
    if (observacoes.trim() !== (task.observacoes ?? "")) {
      saveField("observacoes", observacoes, () =>
        setObservacoes(task.observacoes ?? "")
      );
    }
  }

  function fecharCard() {
    setCardAberto(false);
    // Devolve o foco pro nome da tarefa. O useFocusTrap também tenta
    // restaurar, mas ele guarda quem tinha o foco DEPOIS do autoFocus do
    // botão de fechar — um elemento que já saiu do DOM quando o cartão
    // desmonta. Aqui é explícito e não depende dessa ordem.
    tituloBotaoRef.current?.focus();
  }

  function remove() {
    if (
      !window.confirm(
        `Remover "${task.titulo}"? Comentários e datas vão junto. Não dá pra desfazer.`
      )
    )
      return;
    const fd = baseFd();
    setErroSalvar(null);
    startTransition(async () => {
      try {
        const r = await removeProjectTaskAction(fd);
        if (!r.ok) {
          setErroSalvar(r.erro);
          return;
        }
      } catch {
        setErroSalvar("Não consegui apagar. Confira a conexão.");
        return;
      }
      router.refresh();
      /**
       * O accordion da Lista guarda as subtarefas em estado local (fetch
       * sob demanda): `router.refresh()` re-renderiza o servidor mas não
       * mexe nesse estado, então a linha apagada CONTINUAVA na tela — e
       * parecia que o apagar não funcionou. Só fechar e reabrir a gaveta
       * revelava. Mesma razão do `onCriou` na criação.
       */
      onListaMudou?.();
    });
  }

  const totalCols = (clienteCell ? 1 : 0) + 7;
  const locked = pending || readOnly;
  const vencida = isOverdue(dataVencimento, status);

  // Os mesmos campos servem a linha e ao cartão — um só lugar com a regra
  // de "grava otimista, desfaz se o servidor recusar".
  const campoStatus = campo<TaskStatus>("status", status, setStatus);
  const campoPrioridade = campo("prioridade", prioridade, setPrioridade);
  const campoResponsavel = campo("responsavel", responsavel, setResponsavel);
  const campoDataInicial = campo("dataInicial", dataInicial, setDataInicial);
  const campoDataVencimento = campo(
    "dataVencimento",
    dataVencimento,
    setDataVencimento
  );

  return (
    <>
      <tr
        // Âncora estável da demanda: é o destino do campo `url` de
        // GET /api/demandas, que apps externos usam pra abrir a tarefa aqui.
        id={`tarefa-${task.id}`}
        draggable={false}
        onDragOver={drag?.onDragOver}
        onDrop={drag?.onDrop}
        className={`group border-t border-fysi-line hover:bg-fysi-cream/40 transition-colors scroll-mt-24 target:bg-fysi-yellow/40 ${
          drag?.isDragging ? "opacity-40" : ""
        } ${drag?.isOver ? "bg-fysi-mint/20" : ""}`}
      >
        {clienteCell ? (
          <td className="px-3 py-2 text-sm text-fysi-deep overflow-hidden truncate">
            {clienteCell}
          </td>
        ) : null}
        <td className="px-3 py-2 text-sm text-fysi-deep overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            {drag && !readOnly ? (
              <span
                draggable
                onDragStart={drag.onDragStart}
                onDragEnd={drag.onDragEnd}
                className="text-fysi-muted/0 group-hover:text-fysi-muted hover:!text-fysi-deep cursor-grab active:cursor-grabbing shrink-0 -ml-1 transition-colors"
                title="Arrastar pra reordenar"
              >
                <GripIcon />
              </span>
            ) : null}
            {readOnly ? (
              <span
                className="text-fysi-muted/60 shrink-0"
                title="Somente leitura — tarefa de outra pessoa"
              >
                <LockIcon />
              </span>
            ) : null}
            {renomeando ? (
              <input
                type="text"
                value={titulo}
                autoFocus
                maxLength={200}
                onChange={(e) => setTitulo(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={salvarTitulo}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setTitulo(task.titulo);
                    setRenomeando(false);
                  }
                }}
                aria-label="Nome da tarefa"
                className="flex-1 min-w-0 rounded-[6px] border border-fysi-deep/40 bg-white text-sm text-fysi-deep px-1.5 py-0.5 focus:outline-none"
              />
            ) : (
              <>
                {/* Um clique abre o cartão. O duplo-clique pra renomear
                    saiu daqui: o primeiro clique já abre o cartão, então o
                    segundo nunca chegava — quem quer renomear sem abrir usa
                    o lápis ao lado. */}
                <button
                  ref={tituloBotaoRef}
                  type="button"
                  onClick={() => setCardAberto(true)}
                  aria-haspopup="dialog"
                  aria-expanded={cardAberto}
                  className="text-left hover:underline underline-offset-2 truncate min-w-0"
                  title={`${titulo} — clique pra abrir a tarefa`}
                >
                  {titulo}
                </button>
                <MarcadoresDaTarefa eisenhower={eisenhower} esforco={esforco} />
                {erroSalvar ? (
                  <span
                    role="alert"
                    title={erroSalvar}
                    className="inline-flex items-center gap-1 shrink-0 rounded-full border border-red-200 bg-red-50 px-2 text-[0.62rem] font-semibold leading-[1.15rem] text-red-700"
                  >
                    não salvou
                  </span>
                ) : null}
                {readOnly ? null : (
                  <>
                    <button
                      type="button"
                      onClick={() => setCriandoAbaixo((v) => !v)}
                      disabled={locked}
                      aria-expanded={criandoAbaixo}
                      aria-label={`Adicionar tarefa abaixo de "${titulo}"`}
                      title="Adicionar uma tarefa logo abaixo desta"
                      className={`shrink-0 w-6 h-6 grid place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition ${HOVER_ONLY}`}
                    >
                      <PlusIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenomeando(true)}
                      disabled={locked}
                      aria-label={`Renomear "${titulo}"`}
                      title="Renomear"
                      className={`shrink-0 w-6 h-6 grid place-items-center rounded-md text-fysi-muted hover:text-fysi-deep hover:bg-fysi-cream transition ${HOVER_ONLY}`}
                    >
                      <PencilIcon />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <select
            value={status}
            disabled={locked}
            onChange={(e) =>
              campoStatus.definir(e.target.value as TaskStatus)
            }
            className={`max-w-full rounded-full border text-xs font-medium px-2.5 py-1 cursor-pointer focus:outline-none disabled:opacity-50 ${TASK_STATUS_TONE[status]}`}
          >
            {TASK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2 overflow-hidden">
          <PriorityPicker
            value={prioridade}
            disabled={locked}
            onChange={campoPrioridade.definir}
          />
        </td>
        <td className="px-3 py-2 overflow-hidden">
          <AssigneePicker
            value={responsavel}
            disabled={locked}
            onChange={campoResponsavel.definir}
          />
        </td>
        {/* Datas com o mesmo seletor da barra de criação (atalhos Hoje /
            Amanhã / Próxima segunda). O <input type="date"> nativo não cabia
            na coluna — aparecia cortado como "dd/mm/aa". */}
        <td className="px-2 py-2 overflow-hidden">
          <DueDatePicker
            bare
            emptyLabel="Início"
            value={dataInicial}
            disabled={locked}
            onChange={campoDataInicial.definir}
          />
        </td>
        <td className="px-2 py-2 overflow-hidden">
          <DueDatePicker
            bare
            emptyLabel="Vencimento"
            value={dataVencimento}
            disabled={locked}
            overdue={vencida}
            onChange={campoDataVencimento.definir}
          />
        </td>
        <td className="px-3 py-2 text-right overflow-hidden">
          {readOnly ? null : (
            <button
              type="button"
              onClick={remove}
              disabled={locked}
              aria-label={`Remover "${titulo}"`}
              title="Remover tarefa"
              className={`w-7 h-7 inline-grid place-items-center rounded-md text-fysi-muted hover:text-red-700 hover:bg-red-50 transition disabled:opacity-50 ${HOVER_ONLY}`}
            >
              <TrashIcon />
            </button>
          )}
        </td>
      </tr>
      {criandoAbaixo && !readOnly ? (
        <tr className="bg-fysi-mint/10 border-t border-fysi-line">
          <td colSpan={totalCols} className="px-3 py-2">
            <TaskComposer
              autoFocus
              clientId={task.client_id ?? ""}
              depoisDe={task.id}
              defaultResponsavel={task.responsavel ?? ""}
              defaultArea={task.area ?? ""}
              areaFixa={!task.client_id}
              urlKey={urlKey}
              onClose={() => setCriandoAbaixo(false)}
              onCriou={onListaMudou}
              placeholder={`Nova tarefa abaixo de "${task.titulo}" (Enter adiciona)`}
            />
          </td>
        </tr>
      ) : null}
      {cardAberto ? (
        <TarefaCard
          task={task}
          clientId={clientId}
          urlKey={urlKey}
          readOnly={readOnly}
          locked={!!locked}
          salvando={pending}
          erro={erroSalvar}
          vencida={vencida}
          /* Na visão consolidada a célula do cliente JÁ é um link com o
             nome — vira o caminho no topo do cartão, como o breadcrumb do
             ClickUp, sem precisar buscar o nome de novo. */
          caminho={clienteCell}
          campos={{
            titulo: {
              valor: titulo,
              digitar: setTitulo,
              confirmar: confirmarTitulo,
            },
            descricao: {
              valor: observacoes,
              digitar: setObservacoes,
              confirmar: confirmarDescricao,
            },
            status: campoStatus,
            prioridade: campoPrioridade,
            responsavel: campoResponsavel,
            dataInicial: campoDataInicial,
            dataVencimento: campoDataVencimento,
            eisenhower: campo("eisenhower", eisenhower, setEisenhower),
            esforco: campo("esforco", esforco, setEsforco),
          }}
          onFechar={fecharCard}
          onListaMudou={onListaMudou}
        />
      ) : null}
    </>
  );
}

/**
 * undefined = sem restrição (admin/avancado/legacy). null = "basico" sem
 * vínculo de tarefas (nada editável). string = "basico" com vínculo — só
 * tarefas com esse `responsavel` são editáveis, o resto vira read-only.
 */
export type EditRestriction = string | null | undefined;

export function isReadOnlyFor(task: ProjectTask, restrict: EditRestriction): boolean {
  if (restrict === undefined) return false;
  if (restrict === null) return true;
  return task.responsavel !== restrict;
}

export function TasksBoard({
  clientId,
  urlKey,
  projectType,
  tasks,
  restrictToResponsavel,
}: {
  clientId: string;
  urlKey?: string;
  projectType: ProjectType | null;
  tasks: ProjectTask[];
  restrictToResponsavel?: EditRestriction;
}) {
  const router = useRouter();
  const [mostrarFechados, setMostrarFechados] = useState(false);
  const [pending, startTransition] = useTransition();

  const abertasSource = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "ativo"
  );
  const fechadasSource = tasks.filter(
    (t) => TASK_STATUS_GROUP[t.status] === "fechado"
  );
  const { order: abertas, dragProps: dragAbertas, erroOrdem } = useTaskDrag(
    abertasSource,
    clientId,
    urlKey
  );
  const { order: fechadas, dragProps: dragFechadas } = useTaskDrag(
    fechadasSource,
    clientId,
    urlKey
  );
  const { widths: colWidths, total: colTotal, startResize } = useColumnWidths(
    "fysi-cols-tasksboard",
    [262, 182, 74, 74, 92, 124, 40]
  );

  function seed() {
    const fd = new FormData();
    fd.append("clientId", clientId);
    if (urlKey) fd.append("key", urlKey);
    startTransition(async () => {
      await seedProjectTasksAction(fd);
      router.refresh();
    });
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-medium text-fysi-deep">
            Tarefas do projeto
          </h3>
          {tasks.length > 0 ? (
            <p className="text-sm text-fysi-muted mt-1">
              {fechadasSource.length}/{tasks.length} fechadas
            </p>
          ) : null}
          {erroOrdem ? (
            <p role="alert" className="text-xs text-red-700 mt-1">
              {erroOrdem} A ordem voltou ao que estava.
            </p>
          ) : null}
        </div>
        {tasks.length === 0 && projectType ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={seed}
            disabled={pending}
          >
            {pending ? "Gerando…" : "Gerar tarefas do template"}
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-fysi-muted">
          {projectType
            ? 'Nenhuma tarefa ainda. Clique em "Gerar tarefas do template" pra criar o checklist padrão deste tipo de projeto.'
            : "Defina o tipo de projeto (na Visão geral) antes de gerar as tarefas."}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table
            className="text-sm"
            style={{ width: colTotal, tableLayout: "fixed" }}
          >
            <ColGroup widths={colWidths} />
            <thead className="text-left text-[0.7rem] uppercase tracking-[0.1em] text-fysi-muted">
              <tr>
                <ResizableTh onResizeStart={startResize(0)}>Nome</ResizableTh>
                <ResizableTh onResizeStart={startResize(1)}>Status</ResizableTh>
                <ResizableTh onResizeStart={startResize(2)} title="Prioridade">Prior.</ResizableTh>
                <ResizableTh onResizeStart={startResize(3)} title="Responsável">Resp.</ResizableTh>
                <ResizableTh onResizeStart={startResize(4)}>Início</ResizableTh>
                <ResizableTh onResizeStart={startResize(5)}>Vencimento</ResizableTh>
                <ResizableTh />
              </tr>
            </thead>
            <tbody>
              {abertas.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  clientId={clientId}
                  urlKey={urlKey}
                  drag={
                    abertas.length > 1 && !isReadOnlyFor(t, restrictToResponsavel)
                      ? dragAbertas(t)
                      : undefined
                  }
                  readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                />
              ))}
              {mostrarFechados
                ? fechadas.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      clientId={clientId}
                      urlKey={urlKey}
                      drag={
                        fechadas.length > 1 &&
                        !isReadOnlyFor(t, restrictToResponsavel)
                          ? dragFechadas(t)
                          : undefined
                      }
                      readOnly={isReadOnlyFor(t, restrictToResponsavel)}
                    />
                  ))
                : null}
            </tbody>
          </table>
          {fechadasSource.length > 0 ? (
            <button
              type="button"
              onClick={() => setMostrarFechados((v) => !v)}
              className="mt-3 text-xs text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              {mostrarFechados
                ? "Ocultar fechados"
                : `Mostrar ${fechadasSource.length} fechado${fechadasSource.length === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-fysi-line">
        {restrictToResponsavel === null ? (
          // "basico" sem vínculo de tarefas: o servidor recusaria a criação
          // (a tarefa nasceria sem poder ser editada por quem criou).
          <p className="text-xs text-fysi-muted">
            Pra adicionar tarefas, peça a um sócio pra ligar seu login a um
            responsável em Membros.
          </p>
        ) : (
          <TaskComposer
            clientId={clientId}
            urlKey={urlKey}
            defaultResponsavel={restrictToResponsavel ?? ""}
            lockResponsavel={typeof restrictToResponsavel === "string"}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Marcadores da linha fechada: quadrante e tamanho, só quando preenchidos.
 *
 * Não viram coluna porque a maioria das tarefas não tem nenhum dos dois —
 * uma coluna vazia em 90% das linhas rouba largura de quem precisa dela.
 * Aqui eles ficam colados no nome, e a linha sem marcador não muda de cara.
 */
function MarcadoresDaTarefa({
  eisenhower,
  esforco,
}: {
  eisenhower: string;
  esforco: string;
}) {
  const q = quadranteDe(eisenhower);
  const e = esforcoDe(esforco);
  if (!q && !e) return null;
  return (
    <span className="flex items-center gap-1 shrink-0">
      {q ? (
        <span
          className={`h-2 w-2 rounded-full ${q.ponto}`}
          title={`${q.label} — ${q.acao}`}
        />
      ) : null}
      {e ? (
        <span
          className={`rounded-full border px-1.5 text-[0.6rem] font-semibold leading-[1.15rem] ${e.tom}`}
          title={e.label}
        >
          {e.curto}
        </span>
      ) : null}
    </span>
  );
}
