"use client";

import { formatDiaMes as formatShortDate, formatDataCompleta } from "@/lib/datas";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AREAS,
  EISENHOWER,
  ESFORCOS,
  RECORRENCIAS,
  TASK_PRIORITY_OPTIONS,
  TEAM_MEMBERS,
  esforcoDe,
  quadranteDe,
  recorrenciaDe,
  type Quadrante,
} from "@/lib/project-tasks";

/**
 * Seletores compactos de uma tarefa (prioridade, responsável, prazo,
 * cliente) — os mesmos na linha da tabela, no cartão de "Meu Trabalho" e na
 * barra de criação. Viviam dentro de tasks-board.tsx; saíram pra cá pra
 * barra de criação poder usá-los sem import circular.
 */

const FMT_HOJE_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Hoje (YYYY-MM-DD) no fuso de Brasília — fixo, não o do ambiente.
 * `toISOString()` é UTC: depois das 21h em Brasília "hoje" já virava amanhã
 * e tarefa que vence hoje aparecia como atrasada. Fixar o fuso também faz
 * servidor (Vercel, UTC) e navegador concordarem, sem mismatch de hidratação.
 */
export function hojeISO(): string {
  return FMT_HOJE_SP.format(new Date());
}

/** Soma dias a um YYYY-MM-DD sem passar por fuso (meio-dia UTC não vira o dia). */
function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * "21 set" — curto o bastante pra caber num chip.
 * Reexportado: metade da tabela de tarefas importa daqui.
 */
export { formatShortDate };

/** Cor da bandeira por prioridade — igual ClickUp (bandeira, sem texto ao lado). */
export const TASK_PRIORITY_FLAG: Record<string, string> = {
  "": "text-fysi-line-strong",
  urgente: "text-red-600",
  alta: "text-orange-500",
  normal: "text-blue-500",
  baixa: "text-fysi-muted",
};

export function FlagIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 3a1 1 0 0 1 1-1h11.5a1 1 0 0 1 .8 1.6L15.25 8l3.05 4.4a1 1 0 0 1-.8 1.6H7a1 1 0 0 0-1 1V21a1 1 0 1 1-2 0V3z" />
    </svg>
  );
}

export function CalendarIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

/**
 * Popover ancorado num botão, posicionado com `position: fixed`.
 *
 * Por que fixed: as células da tabela de tarefas têm `overflow-hidden`
 * (é o que faz o título truncar) e a tabela vive num container com
 * `overflow-x-auto`. Um menu `absolute` ali dentro era RECORTADO pela célula
 * — a lista de prioridade/responsável abria e não aparecia. Fixed escapa do
 * recorte sem precisar de portal (portal tiraria o menu de dentro do modal e
 * brigaria com o focus trap).
 */
function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    function posicionar() {
      if (!trigger || !panel) return;
      const t = trigger.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const margem = 8;
      // Abre pra cima quando não cabe embaixo (última linha da lista).
      const cabeEmbaixo = t.bottom + 4 + p.height <= window.innerHeight - margem;
      const top = cabeEmbaixo
        ? t.bottom + 4
        : Math.max(margem, t.top - 4 - p.height);
      const left = Math.max(
        margem,
        Math.min(t.left, window.innerWidth - p.width - margem)
      );
      setPos((atual) =>
        atual && atual.top === top && atual.left === left ? atual : { top, left }
      );
    }
    posicionar();

    // O painel muda de tamanho enquanto aberto: filtrar a busca do
    // ClientPicker encolhe a lista. Quando ele abriu PRA CIMA, a posição
    // foi calculada com a altura inicial — encolher deixava um vão entre o
    // menu e o botão. Reposiciona a cada mudança de tamanho.
    const observador = new ResizeObserver(() => posicionar());
    observador.observe(panel);
    return () => observador.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const alvo = e.target as Node;
      if (triggerRef.current?.contains(alvo)) return;
      if (panelRef.current?.contains(alvo)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    }
    // Rolar a página desancora o menu fixed — fecha em vez de flutuar solto.
    // Rolagem DENTRO do próprio menu (lista longa) não conta.
    function onScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    }
    // Teclado virtual abrindo (busca de cliente focada) redimensiona a
    // janela em alguns Androids — isso não é motivo pra fechar o menu.
    function onResize() {
      if (panelRef.current?.contains(document.activeElement)) return;
      close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const panelStyle: React.CSSProperties = pos
    ? { position: "fixed", top: pos.top, left: pos.left }
    : { position: "fixed", top: 0, left: 0, visibility: "hidden" };

  return {
    open,
    /** Já posicionado e visível — só então dá pra focar algo lá dentro. */
    ready: open && pos !== null,
    toggle: () => (open ? close() : setOpen(true)),
    close,
    triggerRef,
    panelRef,
    panelStyle,
  };
}

const PANEL_CLASS =
  "z-[60] bg-white border border-fysi-line rounded-[12px] shadow-xl py-1";

const BARE_CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-[8px] border border-transparent hover:border-fysi-line hover:bg-white px-1.5 h-7 text-xs tabular-nums transition disabled:opacity-50 whitespace-nowrap";

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-fysi-line bg-white pl-2 pr-2.5 h-7 text-xs font-medium hover:border-fysi-deep/40 transition disabled:opacity-50 disabled:hover:border-fysi-line whitespace-nowrap";

function MenuItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-fysi-cream focus-visible:bg-fysi-cream focus:outline-none ${
        active ? "font-semibold text-fysi-deep" : "text-fysi-muted"
      }`}
    >
      {children}
      {active ? <span className="ml-auto text-fysi-deep">✓</span> : null}
    </button>
  );
}

/** Bandeira colorida — clique abre a lista de prioridades, igual ClickUp. */
export function PriorityPicker({
  value,
  onChange,
  disabled,
  showLabel = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Na barra de criação o chip mostra o nome; na tabela, só a bandeira. */
  showLabel?: boolean;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();
  const current = TASK_PRIORITY_OPTIONS.find((o) => o.value === value);
  const tone = TASK_PRIORITY_FLAG[value] ?? TASK_PRIORITY_FLAG[""];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Prioridade: ${current?.label ?? "Sem prioridade"}`}
        title={`Prioridade: ${current?.label ?? "Sem prioridade"}`}
        className={
          showLabel
            ? `${CHIP_CLASS} ${value ? "text-fysi-deep" : "text-fysi-muted"}`
            : `w-7 h-7 rounded-md grid place-items-center hover:bg-fysi-cream transition disabled:opacity-50 ${tone}`
        }
      >
        <FlagIcon className={showLabel ? tone : undefined} />
        {showLabel ? (value ? current?.label : "Prioridade") : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          style={panelStyle}
          className={`${PANEL_CLASS} w-44`}
        >
          {TASK_PRIORITY_OPTIONS.map((o) => (
            <MenuItem
              key={o.value}
              active={o.value === value}
              onClick={() => {
                onChange(o.value);
                close();
              }}
            >
              <FlagIcon
                className={TASK_PRIORITY_FLAG[o.value] ?? TASK_PRIORITY_FLAG[""]}
              />
              {o.label}
            </MenuItem>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Avatar({
  iniciais,
  cor,
  externo,
  size = "md",
}: {
  iniciais: string;
  cor: string;
  externo?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-5 h-5 text-[0.55rem]" : "w-6 h-6 text-[0.58rem]";
  return (
    <span
      // Externo ganha anel tracejado: quem olha o quadro precisa saber que
      // aquela demanda não está com a equipe interna.
      className={`${dim} rounded-full grid place-items-center font-bold text-white shrink-0 ${cor} ${
        externo ? "outline-2 outline-dashed outline-offset-1 outline-fysi-deep/40" : ""
      }`}
    >
      {iniciais}
    </span>
  );
}

/** Avatar com iniciais — clique abre a lista da equipe, igual ClickUp. */
export function AssigneePicker({
  value,
  onChange,
  disabled,
  showLabel = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();
  const current = TEAM_MEMBERS.find((m) => m.value === value);
  const titulo = current
    ? current.externo
      ? `${current.label} (externo)`
      : current.label
    : "Sem responsável";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Responsável: ${titulo}`}
        title={`Responsável: ${titulo}`}
        className={
          showLabel
            ? `${CHIP_CLASS} !pl-1 ${current ? "text-fysi-deep" : "text-fysi-muted"}`
            : "rounded-full transition disabled:opacity-50 hover:ring-2 hover:ring-fysi-deep/15"
        }
      >
        {current ? (
          <Avatar
            iniciais={current.iniciais}
            cor={current.cor}
            externo={current.externo}
            size={showLabel ? "sm" : "md"}
          />
        ) : (
          <span
            className={`${
              showLabel ? "w-5 h-5" : "w-6 h-6"
            } rounded-full border border-dashed border-fysi-line-strong grid place-items-center text-fysi-muted shrink-0`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </span>
        )}
        {showLabel ? (current ? current.label : "Responsável") : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          style={panelStyle}
          className={`${PANEL_CLASS} w-48 max-h-64 overflow-y-auto`}
        >
          <MenuItem
            active={!value}
            onClick={() => {
              onChange("");
              close();
            }}
          >
            <span className="w-5 h-5 rounded-full border border-dashed border-fysi-line-strong shrink-0" />
            Sem responsável
          </MenuItem>
          {TEAM_MEMBERS.map((m) => (
            <MenuItem
              key={m.value}
              active={m.value === value}
              onClick={() => {
                onChange(m.value);
                close();
              }}
            >
              <Avatar iniciais={m.iniciais} cor={m.cor} size="sm" />
              {m.label}
              {m.externo ? (
                <span className="text-[0.6rem] uppercase tracking-[0.08em] text-fysi-muted font-normal">
                  externo
                </span>
              ) : null}
            </MenuItem>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Prazo com atalhos (Hoje / Amanhã / Próxima segunda / Em 1 semana) — é o
 * que torna rápido dar data a uma tarefa. Em 2026-09-21, 255 das 260
 * demandas abertas estavam sem prazo: o campo só existia como um
 * `<input type="date">` escondido na linha, depois de criada.
 */
export function DueDatePicker({
  value,
  onChange,
  disabled,
  overdue = false,
  bare = false,
  emptyLabel = "Prazo",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  overdue?: boolean;
  /** Dentro da tabela: sem borda até o hover, pra linha não virar grade de botões. */
  bare?: boolean;
  emptyLabel?: string;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();

  const atalhos = useMemo(() => {
    const hoje = hojeISO();
    const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay(); // 0 = domingo
    const ateSegunda = (8 - dow) % 7 || 7;
    const lista = [
      { label: "Hoje", iso: hoje },
      { label: "Amanhã", iso: somarDias(hoje, 1) },
      { label: "Próxima segunda", iso: somarDias(hoje, ateSegunda) },
      { label: "Em 1 semana", iso: somarDias(hoje, 7) },
    ];
    // Numa segunda-feira "Próxima segunda" e "Em 1 semana" são o mesmo dia.
    return lista.filter(
      (a, i) => lista.findIndex((b) => b.iso === a.iso) === i
    );
    // Recalcula a cada abertura — painel aberto de um dia pro outro não pode
    // oferecer "Hoje" com a data de ontem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          value
            ? `${emptyLabel}: ${formatDataCompleta(value)}${overdue ? " — vencido" : ""}`
            : `Definir ${emptyLabel.toLowerCase()}`
        }
        className={`${bare ? BARE_CHIP_CLASS : CHIP_CLASS} ${
          overdue
            ? bare
              ? "text-red-700 font-semibold"
              : "!border-red-300 text-red-700"
            : value
              ? "text-fysi-deep"
              : bare
                ? "text-fysi-muted/70"
                : "text-fysi-muted"
        }`}
      >
        <CalendarIcon />
        {value ? formatShortDate(value) : bare ? null : emptyLabel}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Escolher ${emptyLabel.toLowerCase()}`}
          style={panelStyle}
          className={`${PANEL_CLASS} w-56`}
        >
          {atalhos.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                onChange(a.iso);
                close();
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left hover:bg-fysi-cream focus-visible:bg-fysi-cream focus:outline-none ${
                a.iso === value ? "font-semibold text-fysi-deep" : "text-fysi-deep"
              }`}
            >
              {a.label}
              <span className="text-fysi-muted tabular-nums font-normal">
                {formatShortDate(a.iso)}
              </span>
            </button>
          ))}
          <div className="border-t border-fysi-line mt-1 pt-2 px-3 pb-2 flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[0.65rem] uppercase tracking-[0.1em] text-fysi-muted font-semibold">
              Outra data
              <input
                type="date"
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
                  if (e.target.value) close();
                }}
                className="rounded-[8px] border border-fysi-line bg-white text-xs text-fysi-deep px-2 py-1.5 focus:outline-none focus:border-fysi-deep/40 normal-case tracking-normal font-normal"
              />
            </label>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="text-xs text-fysi-muted hover:text-red-700 text-left"
              >
                Remover prazo
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export interface ClientOption {
  id: string;
  label: string;
}

/** Valor do seletor de cliente: id, "" (interno) ou null (ainda não escolheu). */
export type ClientChoice = string | null;

/**
 * De qual cliente é a tarefa — com busca, porque são dezenas. "Interno" é
 * uma escolha explícita (demanda da agência, sem ficha), nunca o default:
 * tarefa de cliente salva como interna some da ficha dele sem ninguém notar.
 */
export function ClientPicker({
  value,
  options,
  onChange,
  disabled,
}: {
  value: ClientChoice;
  options: ClientOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { open, ready, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);

  // Espera o `ready`: no primeiro render o painel está com visibility
  // hidden (ainda medindo a posição) e elemento invisível não recebe foco.
  useEffect(() => {
    if (ready) buscaRef.current?.focus({ preventScroll: true });
  }, [ready]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, busca]);

  const atual =
    value === null
      ? null
      : value === ""
        ? "Interno"
        : (options.find((o) => o.id === value)?.label ?? "Cliente");

  function escolher(v: string) {
    onChange(v);
    setBusca("");
    close();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={atual ? `Cliente: ${atual}` : "Escolher cliente"}
        className={`${CHIP_CLASS} max-w-[14rem] ${
          atual ? "text-fysi-deep bg-fysi-mint/40 !border-fysi-mint-vivid/50" : "text-fysi-muted"
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
        </svg>
        <span className="truncate">{atual ?? "Cliente"}</span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Escolher cliente"
          style={panelStyle}
          className={`${PANEL_CLASS} w-64`}
        >
          <div className="px-2 pt-1 pb-1.5">
            <input
              ref={buscaRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtradas.length === 1) escolher(filtradas[0].id);
                }
              }}
              placeholder="Buscar cliente…"
              className="w-full rounded-[8px] border border-fysi-line bg-white text-xs px-2.5 py-1.5 focus:outline-none focus:border-fysi-deep/40"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <MenuItem active={value === ""} onClick={() => escolher("")}>
              <span className="w-1.5 h-1.5 rounded-full bg-fysi-deep/50 shrink-0" />
              Interno
              <span className="text-[0.65rem] text-fysi-muted font-normal">
                sem cliente
              </span>
            </MenuItem>
            {filtradas.map((o) => (
              <MenuItem
                key={o.id}
                active={o.id === value}
                onClick={() => escolher(o.id)}
              >
                <span className="truncate">{o.label}</span>
              </MenuItem>
            ))}
            {filtradas.length === 0 ? (
              <p className="px-3 py-2 text-xs text-fysi-muted">
                Nenhum cliente com esse nome.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Área da demanda interna (Comercial, Curso, Financeiro/Administrativo,
 * Processos, Marketing).
 *
 * Só aparece quando a demanda NÃO é de cliente: é a classificação do
 * trabalho da própria agência, o que a Karine pediu pra Tainá conseguir
 * registrar o que chega e não é de projeto nenhum.
 */
export function AreaPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();
  const atual = AREAS.find((a) => a.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={atual ? `Área: ${atual.label}` : "Escolher área"}
        className={`${CHIP_CLASS} max-w-[13rem] ${
          atual ? atual.tom : "text-fysi-muted"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            atual ? atual.barra : "bg-fysi-line-strong"
          }`}
        />
        <span className="truncate">{atual ? atual.label : "Área"}</span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          style={panelStyle}
          className={`${PANEL_CLASS} w-56`}
        >
          <MenuItem
            active={!value}
            onClick={() => {
              onChange("");
              close();
            }}
          >
            <span className="h-2 w-2 rounded-full bg-fysi-line-strong shrink-0" />
            Sem área
          </MenuItem>
          {AREAS.map((a) => (
            <MenuItem
              key={a.value}
              active={a.value === value}
              onClick={() => {
                onChange(a.value);
                close();
              }}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${a.barra}`} />
              {a.label}
            </MenuItem>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Matriz de Eisenhower — grade 2×2 de verdade, não uma lista de quatro
 * rótulos.
 *
 * A matriz só ajuda quando os dois eixos estão à vista: o que faz pensar é
 * ver que "responder e-mail" cai na coluna urgente E na linha "não
 * importante" ao mesmo tempo. Numa lista suspensa isso vira quatro nomes
 * soltos e a pessoa escolhe pelo rótulo que soa melhor, que é o contrário
 * do exercício.
 */
export function EisenhowerPicker({
  value,
  onChange,
  disabled,
  showLabel = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();
  const atual = quadranteDe(value);

  function escolher(v: string) {
    onChange(v === value ? "" : v);
    close();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          atual
            ? `${atual.label} — ${atual.acao}`
            : "Matriz de Eisenhower: urgente × importante"
        }
        className={`${CHIP_CLASS} ${atual ? atual.tom : "text-fysi-muted"}`}
      >
        <IconeMatriz />
        {atual ? atual.label : showLabel ? "Matriz" : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          style={panelStyle}
          className={`${PANEL_CLASS} w-[21rem] p-2.5`}
        >
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 items-stretch">
            <span />
            <span className="text-[0.62rem] uppercase tracking-[0.1em] text-fysi-muted text-center pb-0.5">
              Urgente
            </span>
            <span className="text-[0.62rem] uppercase tracking-[0.1em] text-fysi-muted text-center pb-0.5">
              Não urgente
            </span>

            <EixoVertical texto="Importante" />
            <CelulaMatriz q={EISENHOWER[0]} value={value} onPick={escolher} />
            <CelulaMatriz q={EISENHOWER[1]} value={value} onPick={escolher} />

            <EixoVertical texto="Não import." />
            <CelulaMatriz q={EISENHOWER[2]} value={value} onPick={escolher} />
            <CelulaMatriz q={EISENHOWER[3]} value={value} onPick={escolher} />
          </div>
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                close();
              }}
              className="mt-2 w-full text-center text-xs text-fysi-muted hover:text-fysi-deep py-1"
            >
              Tirar da matriz
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function EixoVertical({ texto }: { texto: string }) {
  return (
    <span className="grid place-items-center px-0.5">
      <span className="text-[0.62rem] uppercase tracking-[0.08em] text-fysi-muted [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
        {texto}
      </span>
    </span>
  );
}

function CelulaMatriz({
  q,
  value,
  onPick,
}: {
  q: Quadrante;
  value: string;
  onPick: (v: string) => void;
}) {
  const ativa = q.value === value;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={ativa}
      onClick={() => onPick(q.value)}
      className={`rounded-[10px] border p-2 text-left transition ${q.tom} ${
        ativa
          ? "ring-2 ring-fysi-deep/40"
          : "opacity-80 hover:opacity-100 hover:ring-1 hover:ring-fysi-deep/20"
      }`}
    >
      <span className="block text-xs font-semibold leading-tight">
        {q.label}
      </span>
      <span className="block text-[0.65rem] leading-snug mt-0.5 opacity-80">
        {q.acao}
      </span>
    </button>
  );
}

/** Quatro quadrados — a matriz, reconhecível sem texto. */
function IconeMatriz() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="7.1" y="0.5" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="0.5" y="7.1" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="7.1" y="7.1" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

/**
 * Tamanho da tarefa. Fica ao lado do prazo de propósito: "quando vence" e
 * "quanto tempo leva" são a mesma pergunta vista de dois lados, e é o par
 * que responde "dá pra fechar isso antes da reunião?".
 */
export function EsforcoPicker({
  value,
  onChange,
  disabled,
  showLabel = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();
  const atual = esforcoDe(value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={atual ? `Tamanho: ${atual.label}` : "Quanto tempo leva"}
        className={`${CHIP_CLASS} ${atual ? atual.tom : "text-fysi-muted"}`}
      >
        <IconeAmpulheta />
        {atual ? atual.curto : showLabel ? "Tempo" : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          style={panelStyle}
          className={`${PANEL_CLASS} w-60`}
        >
          <MenuItem
            active={!value}
            onClick={() => {
              onChange("");
              close();
            }}
          >
            <span className="h-2 w-2 rounded-full bg-fysi-line-strong shrink-0" />
            Sem estimativa
          </MenuItem>
          {ESFORCOS.map((e) => (
            <MenuItem
              key={e.value}
              active={e.value === value}
              onClick={() => {
                onChange(e.value === value ? "" : e.value);
                close();
              }}
            >
              <span
                className={`inline-flex items-center justify-center rounded-full border px-1.5 text-[0.62rem] font-semibold shrink-0 w-14 ${e.tom}`}
              >
                {e.curto}
              </span>
              <span className="truncate">{e.label.split(" — ")[1]}</span>
            </MenuItem>
          ))}
        </div>
      ) : null}
    </>
  );
}

function IconeAmpulheta() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M6 2h12M6 22h12M6 2c0 4 6 6 6 10 0-4 6-6 6-10M6 22c0-4 6-6 6-10 0 4 6 6 6 10" />
    </svg>
  );
}

/**
 * Cadência de uma demanda interna que se repete.
 *
 * Só aparece em demanda da agência: tarefa de PROJETO não se repete, ela
 * acontece uma vez por projeto — e o servidor recusa se tentar.
 */
export function RecorrenciaPicker({
  value,
  onChange,
  disabled,
  showLabel = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelStyle } =
    usePopover();
  const atual = recorrenciaDe(value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          atual
            ? `Repete ${atual.curto}. A próxima nasce quando esta for concluída.`
            : "Repetir esta demanda"
        }
        className={`${CHIP_CLASS} ${
          atual
            ? "bg-indigo-50 text-indigo-800 border-indigo-200"
            : "text-fysi-muted"
        }`}
      >
        <IconeRepetir />
        {atual ? atual.curto : showLabel ? "Repetir" : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          style={panelStyle}
          className={`${PANEL_CLASS} w-64`}
        >
          <MenuItem
            active={!value}
            onClick={() => {
              onChange("");
              close();
            }}
          >
            <span className="h-2 w-2 rounded-full bg-fysi-line-strong shrink-0" />
            Não se repete
          </MenuItem>
          {RECORRENCIAS.map((r) => (
            <MenuItem
              key={r.value}
              active={r.value === value}
              onClick={() => {
                onChange(r.value === value ? "" : r.value);
                close();
              }}
            >
              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
              {r.label}
            </MenuItem>
          ))}
          <p className="px-3 pt-2 pb-1 text-[0.66rem] leading-snug text-fysi-muted border-t border-fysi-line mt-1">
            A próxima nasce quando você concluir esta. Se esta ficar aberta,
            não acumula cópia — fica uma só, vencida.
          </p>
        </div>
      ) : null}
    </>
  );
}

/** Duas setas em ciclo. */
function IconeRepetir() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
