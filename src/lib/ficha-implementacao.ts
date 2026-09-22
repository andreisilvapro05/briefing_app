import type { CredencialItem } from "./briefing-credenciais";

/**
 * A "ficha de implementação" de uma página: tudo que quem vai montar a
 * página precisa ter na mão, num lugar só.
 *
 * Pedido da Karine (2026-09-22): "Daniel precisará de um usuário só com
 * dados de acesso e figma na tarefa dele e links de botão, pixel, se tiver".
 *
 * Mora nas colunas de `ei_documents` (migration
 * 20260922140000_ficha_implementacao_desenvolvedor) porque a Estrutura
 * Inicial já É o documento por página do projeto — e porque o Modelo de EI
 * já previa três desses quatro itens, só que como título de texto corrido,
 * que não dá pra ler nem mostrar em separado.
 *
 * A ficha é lida SOZINHA, sem o corpo do documento: o corpo da EI tem copy,
 * briefing e referências, que não são da conta de quem só implementa.
 */

/** Um botão da página e pra onde ele leva (WhatsApp, formulário, âncora…). */
export interface BotaoPagina {
  rotulo: string;
  destino: string;
}

/** Um pixel/tag de rastreamento a instalar na página. */
export interface PixelPagina {
  /** "Meta", "Google Ads", "GA4", "TikTok"… — texto livre, a lista muda sozinha. */
  tipo: string;
  /** O ID em si, ou o trecho de script. */
  identificador: string;
  /** Onde instalar, evento a disparar, o que mais for preciso saber. */
  observacao: string;
}

export interface FichaImplementacao {
  /** O documento de Estrutura Inicial que guarda a ficha. */
  docId: string;
  clientId: string;
  /** Nome do documento como a sidebar de EI mostra (empresa/nome do cliente). */
  titulo: string;
  figmaUrl: string | null;
  botoes: BotaoPagina[];
  pixels: PixelPagina[];
  /** Acessos do cliente — o dado mais sensível da ficha. Ver docs em getFichaDaTarefa. */
  acessos: CredencialItem[];
  atualizadoEm: string;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Normaliza o jsonb cru em lista tipada, jogando fora linha vazia.
 *
 * O banco aceita qualquer JSON nessas colunas, e a importação de EI (outro
 * caminho de escrita) pode gravar formato diferente — então a leitura nunca
 * confia no shape.
 */
export function normalizarBotoes(raw: unknown): BotaoPagina[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      return { rotulo: texto(o.rotulo), destino: texto(o.destino) };
    })
    .filter((b) => b.rotulo || b.destino);
}

export function normalizarPixels(raw: unknown): PixelPagina[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return {
        tipo: texto(o.tipo),
        identificador: texto(o.identificador),
        observacao: texto(o.observacao),
      };
    })
    .filter((p) => p.tipo || p.identificador || p.observacao);
}

export function normalizarAcessos(raw: unknown): CredencialItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        contexto: texto(o.contexto) || "Acessos",
        rotulo: texto(o.rotulo),
        valor: texto(o.valor),
      };
    })
    .filter((c) => c.rotulo || c.valor);
}

/** A ficha tem alguma coisa preenchida? Estado vazio da tela depende disso. */
export function fichaVazia(f: FichaImplementacao): boolean {
  return (
    !f.figmaUrl &&
    f.botoes.length === 0 &&
    f.pixels.length === 0 &&
    f.acessos.length === 0
  );
}

/**
 * Só o host de uma URL, pra mostrar "wa.me" em vez de 180 caracteres de
 * link com parâmetros. Devolve null se não for URL — o destino pode ser uma
 * âncora ("#formulario") ou uma instrução ("mesmo do botão do topo").
 */
export function hostDe(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}
