import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import ical from "node-ical";
import { getCurrentMember } from "@/lib/member";
import { errorResponse, logServerError } from "@/lib/api-helpers";

/**
 * Agenda do dia a partir do "endereço secreto em formato iCal" do Google
 * Agenda (Configurações → seu calendário → Endereço secreto iCal). A URL
 * fica no NAVEGADOR da pessoa (localStorage) — este endpoint só faz o
 * proxy do fetch (o ICS do Google não permite CORS) e devolve os eventos
 * de HOJE (horário de São Paulo), com recorrência expandida.
 *
 * Segurança: só aceita URLs do calendar.google.com (anti-SSRF) e exige
 * membro logado.
 */

const Body = z.object({ icsUrl: z.string().url().max(600) });

const TZ = "America/Sao_Paulo";

interface AgendaEvent {
  titulo: string;
  inicio: string; // "HH:MM" em SP, ou "dia todo"
  fim: string | null;
  diaTodo: boolean;
  /** Instante exato do início (ISO/UTC) — o cliente usa pra contar quanto falta. */
  inicioISO: string | null;
  fimISO: string | null;
}

function spDateParts(d: Date): { ymd: string; hm: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hm: `${get("hour")}:${get("minute")}`,
  };
}

export async function POST(request: NextRequest) {
  const member = await getCurrentMember({ urlKey: null });
  if (!member) return errorResponse("unauthenticated", 401);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  let url: URL;
  try {
    url = new URL(body.icsUrl);
  } catch {
    return errorResponse("url-invalid", 400);
  }
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "calendar.google.com" &&
      !url.hostname.endsWith(".calendar.google.com"))
  ) {
    return errorResponse("only-google-calendar", 400);
  }

  let icsText: string;
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "FysiPainel/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    // 404 aqui quase sempre é o endereço PÚBLICO de um calendário que não
    // está público — caso mais comum na prática. Vale um erro próprio pra
    // UI conseguir explicar o que fazer, em vez de "falhou".
    if (res.status === 404) return errorResponse("ics-nao-encontrado", 404);
    if (!res.ok) return errorResponse("ics-fetch-failed", 502);
    icsText = await res.text();
  } catch (err) {
    logServerError("agenda.fetch", err);
    return errorResponse("ics-fetch-failed", 502);
  }

  const hoje = spDateParts(new Date()).ymd;
  const eventos: AgendaEvent[] = [];

  try {
    const parsed = ical.sync.parseICS(icsText);
    // Janela de hoje em UTC generosa (±1 dia) pra expandir recorrências.
    const windowStart = new Date(Date.now() - 36 * 3600 * 1000);
    const windowEnd = new Date(Date.now() + 36 * 3600 * 1000);

    for (const item of Object.values(parsed)) {
      if (!item || item.type !== "VEVENT") continue;
      const ev = item;

      const starts: { start: Date; end: Date | null }[] = [];
      if (ev.rrule) {
        const durMs =
          ev.end && ev.start ? ev.end.getTime() - ev.start.getTime() : 0;
        for (const occ of ev.rrule.between(windowStart, windowEnd, true)) {
          starts.push({
            start: occ,
            end: durMs ? new Date(occ.getTime() + durMs) : null,
          });
        }
      } else if (ev.start) {
        starts.push({ start: ev.start, end: ev.end ?? null });
      }

      for (const { start, end } of starts) {
        const sp = spDateParts(start);
        if (sp.ymd !== hoje) continue;
        const diaTodo =
          (ev.datetype as string | undefined) === "date" ||
          (start.getUTCHours() === 0 &&
            start.getUTCMinutes() === 0 &&
            !!end &&
            end.getTime() - start.getTime() >= 24 * 3600 * 1000);
        eventos.push({
          titulo: String(ev.summary ?? "(sem título)").slice(0, 120),
          inicio: diaTodo ? "dia todo" : sp.hm,
          fim: diaTodo || !end ? null : spDateParts(end).hm,
          diaTodo,
          inicioISO: diaTodo ? null : start.toISOString(),
          fimISO: diaTodo || !end ? null : end.toISOString(),
        });
      }
    }
  } catch (err) {
    logServerError("agenda.parse", err);
    return errorResponse("ics-parse-failed", 502);
  }

  eventos.sort((a, b) =>
    a.diaTodo === b.diaTodo ? a.inicio.localeCompare(b.inicio) : a.diaTodo ? -1 : 1
  );

  return NextResponse.json({ hoje, eventos: eventos.slice(0, 12) });
}
