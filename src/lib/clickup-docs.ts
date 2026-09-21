import { getServerEnv } from "./env";

/**
 * Leitura dos Docs do ClickUp (API v3) — usada pra importar os briefings
 * reais pro app. O doc de briefings da Fysi é
 * https://app.clickup.com/31006509/docs/xj7td-41071 e tem ~160 páginas,
 * uma por cliente.
 *
 * Os v2 endpoints de doc foram descontinuados; o que responde hoje é
 * /api/v3/workspaces/{workspace}/docs/{doc}/pages.
 */

const WORKSPACE_ID = process.env.CLICKUP_WORKSPACE_ID ?? "31006509";
const BRIEFINGS_DOC_ID = process.env.CLICKUP_BRIEFINGS_DOC_ID ?? "xj7td-41071";

export interface ClickUpDocPage {
  id: string;
  name: string;
  content: string;
  dateUpdated: string | null;
  parentPageId: string | null;
}

export interface ClickUpDocsResultado {
  ok: boolean;
  reason?: string;
  pages: ClickUpDocPage[];
}

function toIso(v: unknown): string | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

/**
 * Busca TODAS as páginas do doc de briefings, já com o conteúdo em
 * markdown. `max_page_depth=-1` traz as subpáginas junto (algumas páginas
 * do ClickUp têm filhas, ex.: "Laissa").
 */
export async function fetchBriefingPages(): Promise<ClickUpDocsResultado> {
  const env = getServerEnv();
  if (!env.clickupToken) {
    return {
      ok: false,
      reason: "ClickUp não configurado (falta CLICKUP_API_TOKEN).",
      pages: [],
    };
  }

  const url =
    `https://api.clickup.com/api/v3/workspaces/${WORKSPACE_ID}` +
    `/docs/${BRIEFINGS_DOC_ID}/pages` +
    `?max_page_depth=-1&content_format=text%2Fmd`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: env.clickupToken },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "Não consegui falar com o ClickUp.", pages: [] };
  }

  if (!res.ok) {
    return {
      ok: false,
      reason: `ClickUp respondeu ${res.status} ao listar as páginas do doc.`,
      pages: [],
    };
  }

  const bruto = (await res.json()) as unknown;
  // A v3 devolve ora um array direto, ora { pages: [...] }.
  const lista = Array.isArray(bruto)
    ? bruto
    : ((bruto as { pages?: unknown[] })?.pages ?? []);

  const pages: ClickUpDocPage[] = [];
  const achatar = (nodes: unknown[]) => {
    for (const node of nodes) {
      const p = node as {
        id?: string;
        name?: string;
        content?: string;
        date_updated?: unknown;
        parent_page_id?: string | null;
        pages?: unknown[];
      };
      if (p?.id) {
        pages.push({
          id: p.id,
          name: (p.name ?? "").trim() || "Sem título",
          content: p.content ?? "",
          dateUpdated: toIso(p.date_updated),
          parentPageId: p.parent_page_id ?? null,
        });
      }
      if (Array.isArray(p?.pages) && p.pages.length) achatar(p.pages);
    }
  };
  achatar(lista as unknown[]);

  return { ok: true, pages };
}
