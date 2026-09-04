"use client";

import { useEffect, useRef, useState } from "react";
import {
  salvarAgendaIcsAction,
  removerAgendaIcsAction,
  temAgendaNaContaAction,
} from "@/app/admin/meu-trabalho/actions";

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
  inicioISO: string | null;
  fimISO: string | null;
  link: string | null;
}

const LS_AVISOS = "fysi-agenda-avisos";
/** Minutos de antecedência do aviso. */
const AVISO_ANTES_MIN = 10;

/**
 * Estado da próxima reunião: acontecendo agora, ou faltando N minutos.
 * Ignora eventos de dia todo (não têm hora pra avisar).
 */
function proximaReuniao(
  eventos: AgendaEvent[],
  agora: number
): { ev: AgendaEvent; minutos: number; emAndamento: boolean } | null {
  let melhor: { ev: AgendaEvent; minutos: number; emAndamento: boolean } | null =
    null;
  for (const ev of eventos) {
    if (!ev.inicioISO) continue;
    const inicio = new Date(ev.inicioISO).getTime();
    const fim = ev.fimISO ? new Date(ev.fimISO).getTime() : inicio;
    if (agora >= inicio && agora < fim) {
      return { ev, minutos: 0, emAndamento: true };
    }
    if (inicio > agora) {
      const minutos = Math.round((inicio - agora) / 60000);
      if (!melhor || minutos < melhor.minutos) {
        melhor = { ev, minutos, emAndamento: false };
      }
    }
  }
  return melhor;
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
  const weekday = get("weekday");
  return {
    hm: `${get("hour")}:${get("minute")}`,
    // Só a primeira letra maiúscula ("Quarta-feira, 2 de setembro") — a
    // classe `capitalize` do Tailwind capitalizava TODA palavra ("2 De…").
    dataLonga: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${get("day")} de ${get("month")}`,
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

export function DayHero({ nome, urlKey = null }: { nome: string; urlKey?: string | null }) {
  // null até montar — evita mismatch de hidratação (relógio muda a cada render).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Relógio só começa depois de montar — renderizar hora no servidor
    // daria mismatch de hidratação a cada segundo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <p className="text-sm text-fysi-deep/70 mt-1.5 min-h-[1.25rem]">
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

      <AgendaCard urlKey={urlKey} />
    </div>
  );
}

function AgendaCard({ urlKey }: { urlKey: string | null }) {
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  /** Agenda salva na conta — vale em qualquer aparelho, sem URL no navegador. */
  const [naConta, setNaConta] = useState(false);
  const [draft, setDraft] = useState("");
  const [configuring, setConfiguring] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [eventos, setEventos] = useState<AgendaEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Relógio próprio (30s) — move o contador "faltam N min" e dispara avisos.
  const [agora, setAgora] = useState<number>(() => Date.now());
  const [avisosOn, setAvisosOn] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | "indisponivel">(
    "indisponivel"
  );
  // Evita repetir o mesmo aviso a cada tique.
  const avisados = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Permite configurar por link: /admin/meu-trabalho?agenda=<url do iCal>.
    // Serve pra ativar a agenda num aparelho novo (celular) sem copiar e
    // colar na mão. O parâmetro é REMOVIDO da URL logo em seguida — o
    // endereço iCal é secreto e não deve ficar na barra nem no histórico.
    let fromUrl: string | null = null;
    try {
      const sp = new URLSearchParams(window.location.search);
      const candidato = sp.get("agenda");
      if (candidato) {
        const u = new URL(candidato);
        if (
          u.protocol === "https:" &&
          (u.hostname === "calendar.google.com" ||
            u.hostname.endsWith(".calendar.google.com"))
        ) {
          fromUrl = candidato;
          window.localStorage.setItem(LS_KEY, candidato);
        }
        sp.delete("agenda");
        const q = sp.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${q ? `?${q}` : ""}`
        );
      }
    } catch {
      // URL inválida ou localStorage indisponível — ignora
    }

    try {
      // localStorage não existe no servidor — leitura só após montar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIcsUrl(fromUrl ?? window.localStorage.getItem(LS_KEY));
    } catch {
      setIcsUrl(fromUrl);
    }

    // Se a agenda está salva NA CONTA, ela vale mesmo sem nada guardado
    // neste navegador — é o que faz funcionar no celular sem reconfigurar.
    void temAgendaNaContaAction(urlKey).then((tem) => {
      if (tem) setNaConta(true);
    });

    setLoaded(true);

    // Preferência de avisos + permissão atual do navegador.
    try {
      if (typeof Notification !== "undefined") {
        setPermissao(Notification.permission);
        setAvisosOn(
          window.localStorage.getItem(LS_AVISOS) === "1" &&
            Notification.permission === "granted"
        );
      }
    } catch {
      // navegador sem Notification API — segue só com o aviso visual
    }
    // urlKey é estável dentro da página (vem da URL) — incluído só pra
    // satisfazer a regra de deps; não causa re-execução na prática.
  }, [urlKey]);

  // Tique de 30s: atualiza o contador da próxima reunião e checa avisos.
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!icsUrl && !naConta) return;
    let cancel = false;
    // Reset antes de buscar — o efeito É a sincronização com a API externa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setEventos(null);
    fetch("/api/admin/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Sem icsUrl o servidor usa a agenda salva na conta.
      body: JSON.stringify(icsUrl && !naConta ? { icsUrl } : {}),
    })
      .then(async (res) => {
        if (!res.ok) {
          const code = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => undefined);
          throw new Error(code ?? String(res.status));
        }
        const data = (await res.json()) as { eventos: AgendaEvent[] };
        if (!cancel) setEventos(data.eventos);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        const code = err instanceof Error ? err.message : "";
        setError(
          code === "ics-nao-encontrado"
            ? "Esse endereço não existe ou o calendário não está público. Use o “Endereço secreto em formato iCal” (o que tem /private- no meio)."
            : code === "only-google-calendar"
              ? "Só aceito link do Google Agenda (calendar.google.com)."
              : "Não consegui ler a agenda. Confere o link e tenta de novo."
        );
      });
    return () => {
      cancel = true;
    };
  }, [icsUrl, naConta]);

  const proxima = eventos ? proximaReuniao(eventos, agora) : null;

  // Dispara a notificação do navegador: uma AVISO_ANTES_MIN antes e outra
  // na hora de começar. Só funciona com o painel aberto em alguma aba —
  // notificação com o app fechado exigiria push/service worker.
  useEffect(() => {
    if (!avisosOn || !proxima || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const chave = `${proxima.ev.inicioISO}|${proxima.emAndamento ? "inicio" : "antes"}`;
    if (avisados.current.has(chave)) return;

    if (proxima.emAndamento) {
      avisados.current.add(chave);
      new Notification("Sua reunião começou", {
        body: proxima.ev.titulo,
        tag: chave,
      });
    } else if (proxima.minutos <= AVISO_ANTES_MIN) {
      avisados.current.add(chave);
      new Notification(`Reunião em ${proxima.minutos} min`, {
        body: `${proxima.ev.inicio} · ${proxima.ev.titulo}`,
        tag: chave,
      });
    }
  }, [avisosOn, proxima]);

  async function ligarAvisos() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermissao(p);
    const on = p === "granted";
    setAvisosOn(on);
    try {
      window.localStorage.setItem(LS_AVISOS, on ? "1" : "0");
    } catch {
      // sem localStorage — vale só nesta visita
    }
  }

  function desligarAvisos() {
    setAvisosOn(false);
    try {
      window.localStorage.setItem(LS_AVISOS, "0");
    } catch {
      // ok
    }
  }

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
    // Guarda na conta pra valer em qualquer aparelho (o localStorage acima é
    // só pra sessão de senha compartilhada, que não tem conta própria).
    void salvarAgendaIcsAction(v, urlKey).then((r) => {
      if (r.ok) setNaConta(true);
    });
  }

  function disconnect() {
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch {
      // ok
    }
    setIcsUrl(null);
    setEventos(null);
    setNaConta(false);
    void removerAgendaIcsAction(urlKey);
  }

  return (
    <section className="bg-white border border-fysi-line rounded-[24px] shadow-fysi-card p-6 flex flex-col gap-2.5 min-h-[150px]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.68rem] uppercase tracking-[0.16em] font-semibold text-fysi-muted">
          📅 Agenda de hoje
        </p>
        {icsUrl || naConta ? (
          <div className="flex items-center gap-2 shrink-0">
            {avisosOn ? (
              <button
                type="button"
                onClick={desligarAvisos}
                title={`Avisando ${AVISO_ANTES_MIN} min antes (com o painel aberto)`}
                className="text-[0.68rem] text-fysi-deep font-medium hover:underline underline-offset-2"
              >
                🔔 avisos ligados
              </button>
            ) : permissao !== "denied" ? (
              <button
                type="button"
                onClick={ligarAvisos}
                className="text-[0.68rem] text-fysi-deep font-medium hover:underline underline-offset-2"
              >
                🔕 ligar avisos
              </button>
            ) : (
              <span
                className="text-[0.68rem] text-fysi-muted"
                title="Você bloqueou notificações deste site no navegador"
              >
                avisos bloqueados
              </span>
            )}
            <button
              type="button"
              onClick={disconnect}
              className="text-[0.68rem] text-fysi-muted hover:text-fysi-deep underline underline-offset-2"
            >
              desconectar
            </button>
          </div>
        ) : null}
      </div>

      {/* Aviso da próxima reunião — vira destaque quando está perto */}
      {proxima ? (
        <div
          className={`rounded-[12px] px-3 py-2 border ${
            proxima.emAndamento
              ? "bg-red-50 border-red-200"
              : proxima.minutos <= 15
                ? "bg-amber-50 border-amber-200"
                : "bg-fysi-mint/30 border-fysi-mint-vivid/40"
          }`}
        >
          <p
            className={`text-xs font-semibold ${
              proxima.emAndamento
                ? "text-red-700"
                : proxima.minutos <= 15
                  ? "text-amber-800"
                  : "text-fysi-deep"
            }`}
          >
            {proxima.emAndamento
              ? "🔴 Acontecendo agora"
              : proxima.minutos < 60
                ? `⏰ Em ${proxima.minutos} min`
                : `⏰ Às ${proxima.ev.inicio}`}
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-fysi-deep truncate">{proxima.ev.titulo}</p>
            {proxima.ev.link ? (
              <a
                href={proxima.ev.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-fysi-deep text-fysi-cream text-xs font-semibold px-3 py-1 hover:bg-fysi-deep/90"
              >
                Entrar →
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loaded ? null : !icsUrl && !naConta ? (
        configuring ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-fysi-muted leading-relaxed">
              No Google Agenda: ⚙️ Configurações → clica no seu calendário na
              lista da esquerda → role até{" "}
              <strong>&quot;Endereço secreto em formato iCal&quot;</strong> →
              copia e cola aqui. É o link que tem{" "}
              <span className="font-mono">/private-</span> no meio — o
              endereço <span className="font-mono">/public/</span> só funciona
              se o calendário for público. Fica salvo neste navegador.
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
        <div className="my-auto flex flex-col items-start gap-2">
          <p className="text-xs text-red-600 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setConfiguring(true);
            }}
            className="rounded-full bg-fysi-deep text-fysi-cream text-xs font-medium px-3 py-1.5 hover:bg-fysi-deep/90"
          >
            Trocar o link
          </button>
        </div>
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
              <span className="truncate text-fysi-deep flex-1">{ev.titulo}</span>
              {ev.link ? (
                <a
                  href={ev.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Entrar na chamada"
                  className="shrink-0 text-xs font-medium text-fysi-deep hover:underline underline-offset-2"
                >
                  Entrar →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
