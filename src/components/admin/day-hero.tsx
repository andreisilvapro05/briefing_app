"use client";

import { useEffect, useState } from "react";

/**
 * Hero do "Meu Trabalho" — estilo Apple, pedido da Karine (2026-09-02):
 * relógio grande com gradiente suave, "frase do dia" com saudação e a
 * agenda de hoje puxada do Google Agenda (endereço secreto iCal, guardado
 * só no navegador da pessoa via localStorage; o servidor apenas faz o
 * proxy do fetch — ver /api/admin/agenda).
 */

const FRASES = [
  "Feito é melhor que perfeito — entrega e melhora depois.",
  "Um projeto de cada vez, com capricho.",
  "Clareza no briefing, paz na entrega.",
  "Hoje é dia de tirar uma tarefa do “em atraso”.",
  "Design bom resolve; design ótimo encanta.",
  "Responde aquele cliente que você tá adiando.",
  "Pequenos avanços todo dia viram grandes entregas.",
  "Menos abas abertas, mais foco.",
  "Delegar também é produzir.",
  "Revisa antes de enviar — dois minutos que salvam o dia.",
  "O cliente sente o cuidado nos detalhes.",
  "Começa pelo mais difícil, o resto flui.",
  "Prazo é promessa — combina antes de estourar.",
  "Bebe água e fecha uma tarefa. 💧",
];

const TZ = "America/Sao_Paulo";
const LS_KEY = "fysi-agenda-ics-url";

interface AgendaEvent {
  titulo: string;
  inicio: string;
  fim: string | null;
  diaTodo: boolean;
}

function spNow(now: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hora = Number(get("hour"));
  return {
    hm: `${get("hour")}:${get("minute")}`,
    dataLonga: `${get("weekday")}, ${get("day")} de ${get("month")}`,
    hora,
  };
}

function saudacao(hora: number): { texto: string; emoji: string } {
  if (hora < 12) return { texto: "BOM DIA", emoji: "☀️" };
  if (hora < 18) return { texto: "BOA TARDE", emoji: "🌤️" };
  return { texto: "BOA NOITE", emoji: "🌙" };
}

function fraseDoDia(now: Date): string {
  const diaDoAno = Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000
  );
  return FRASES[diaDoAno % FRASES.length];
}

export function DayHero({ nome }: { nome: string }) {
  // null até montar — evita mismatch de hidratação (relógio muda a cada render).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const sp = now ? spNow(now) : null;
  const sauda = sp ? saudacao(sp.hora) : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[290px_1fr_1fr] mb-6">
      {/* Relógio — gradiente suave estilo Apple, na paleta Fysi */}
      <section
        className="rounded-[24px] p-6 flex flex-col justify-between min-h-[150px] shadow-fysi-card border border-white/60"
        style={{
          background:
            "linear-gradient(135deg, #8DE2C5 0%, #DFF5EC 45%, #F7F6F4 100%)",
        }}
      >
        <p className="text-[0.68rem] uppercase tracking-[0.16em] font-semibold text-fysi-deep/60">
          Agora em São Paulo
        </p>
        <div>
          <p className="text-[3rem] leading-none font-semibold tracking-tight text-fysi-deep tabular-nums min-h-[3rem]">
            {sp?.hm ?? ""}
          </p>
          <p className="text-sm text-fysi-deep/70 mt-1.5 capitalize min-h-[1.25rem]">
            {sp?.dataLonga ?? ""}
          </p>
        </div>
      </section>

      {/* Frase do dia */}
      <section className="bg-white border border-fysi-line rounded-[24px] shadow-fysi-card p-6 flex flex-col justify-center gap-2 min-h-[150px]">
        <p className="text-[0.68rem] uppercase tracking-[0.16em] font-semibold text-fysi-muted min-h-[1rem]">
          {sauda ? `${sauda.emoji} ${sauda.texto}${nome ? `, ${nome.toUpperCase()}` : ""}` : ""}
        </p>
        <p className="text-xl leading-snug font-medium text-fysi-deep min-h-[1.75rem]">
          {now ? fraseDoDia(now) : ""}
        </p>
      </section>

      <AgendaCard />
    </div>
  );
}

function AgendaCard() {
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [configuring, setConfiguring] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [eventos, setEventos] = useState<AgendaEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setIcsUrl(window.localStorage.getItem(LS_KEY));
    } catch {
      // localStorage indisponível — segue sem agenda
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!icsUrl) return;
    let cancel = false;
    setError(null);
    setEventos(null);
    fetch("/api/admin/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icsUrl }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { eventos: AgendaEvent[] };
        if (!cancel) setEventos(data.eventos);
      })
      .catch(() => {
        if (!cancel)
          setError("Não consegui ler a agenda. Confere o link e tenta de novo.");
      });
    return () => {
      cancel = true;
    };
  }, [icsUrl]);

  function save() {
    const v = draft.trim();
    if (!v) return;
    try {
      window.localStorage.setItem(LS_KEY, v);
    } catch {
      // sem localStorage — usa só nesta visita
    }
    setIcsUrl(v);
    setConfiguring(false);
    setDraft("");
  }

  function disconnect() {
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch {
      // ok
    }
    setIcsUrl(null);
    setEventos(null);
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[24px] shadow-fysi-card p-6 flex flex-col gap-2.5 min-h-[150px]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.68rem] uppercase tracking-[0.16em] font-semibold text-fysi-muted">
          📅 Agenda de hoje
        </p>
        {icsUrl ? (
          <button
            type="button"
            onClick={disconnect}
            className="text-[0.68rem] text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
          >
            desconectar
          </button>
        ) : null}
      </div>

      {!loaded ? null : !icsUrl ? (
        configuring ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-fysi-muted leading-relaxed">
              No Google Agenda: ⚙️ Configurações → clica no seu calendário →{" "}
              <strong>&quot;Endereço secreto em formato iCal&quot;</strong> →
              copia e cola aqui. Fica salvo só neste navegador.
            </p>
            <div className="flex gap-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…"
                className="flex-1 min-w-0 rounded-[10px] border border-fysi-line bg-white px-2.5 py-1.5 text-xs text-fysi-deep focus:outline-none focus:border-fysi-deep/40"
              />
              <button
                type="button"
                onClick={save}
                disabled={!draft.trim()}
                className="rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-1.5 hover:bg-fysi-deep/90 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2 my-auto">
            <p className="text-sm text-fysi-muted">
              Veja aqui suas chamadas e compromissos do dia.
            </p>
            <button
              type="button"
              onClick={() => setConfiguring(true)}
              className="rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3.5 py-1.5 hover:bg-fysi-deep/90"
            >
              Conectar Google Agenda
            </button>
          </div>
        )
      ) : error ? (
        <p className="text-xs text-red-600 my-auto">{error}</p>
      ) : eventos === null ? (
        <p className="text-xs text-fysi-muted my-auto">Carregando agenda…</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-fysi-muted my-auto">
          Sem compromissos hoje 🎉
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 overflow-y-auto max-h-36 pr-1">
          {eventos.map((ev, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              <span className="shrink-0 tabular-nums text-xs font-semibold text-fysi-deep bg-fysi-mint/50 rounded-full px-2 py-0.5">
                {ev.diaTodo ? "dia todo" : ev.inicio}
              </span>
              <span className="truncate text-fysi-deep">{ev.titulo}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
