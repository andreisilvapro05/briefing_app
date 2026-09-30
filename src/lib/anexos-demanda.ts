import { MAX_UPLOAD_BYTES } from "./uploads";
/**
 * Anexos de uma demanda — o arquivo em si ou o link pra onde ele mora.
 *
 * Karine (2026-09-30): "na parte de demandas ter uma parte para anexar o
 * arquivo ou link de arquivos". As duas formas convivem porque a agência
 * trabalha das duas: a pasta do Drive é o caso comum, e o print que chegou
 * no WhatsApp precisa de um lugar antes de virar pasta.
 */

export type TipoAnexo = "link" | "arquivo";

export interface AnexoDemanda {
  id: string;
  tipo: TipoAnexo;
  /** Só em `link`. */
  url?: string;
  /** Só em `arquivo` — caminho no bucket privado, nunca exposto ao navegador. */
  path?: string;
  /** O que aparece na lista. */
  nome: string;
  mime?: string;
  tamanho?: number;
  criado_em: string;
  criado_por?: string | null;
}

/**
 * O teto é o do app inteiro, com folga sob o limite de transporte da
 * Vercel — ver src/lib/uploads.ts. Aqui ele dói menos que em outros
 * lugares: arquivo maior tem a saída natural, que é colar o link.
 */
export const MAX_ANEXO_BYTES = MAX_UPLOAD_BYTES;

export const MAX_ANEXOS_POR_DEMANDA = 20;

/** Tipos que a equipe de fato anexa. Executável não entra. */
export const TIPOS_ANEXO_ACEITOS = [
  "image/",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/zip",
];

export function tipoDeArquivoAceito(mime: string): boolean {
  return TIPOS_ANEXO_ACEITOS.some((t) => mime.startsWith(t));
}

/**
 * Só http(s).
 *
 * `javascript:` num href é XSS clicável, e a lista de anexos é escrita por
 * uma pessoa e lida por outra. `mailto:`/`tel:` ficam de fora por não
 * serem arquivo — não é censura, é não prometer o que a tela não faz.
 */
export function linkValido(bruto: string): boolean {
  const limpo = bruto.trim();
  if (!limpo) return false;
  try {
    const u = new URL(limpo);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Nome que aparece na lista quando ninguém escreveu um.
 *
 * Tenta o arquivo no fim do caminho ("Briefing.pdf"); se o link não tem
 * nome de arquivo — o caso do Drive, que termina em id — fica o domínio,
 * que ao menos diz de onde é.
 */
export function nomeDoLink(url: string): string {
  try {
    const u = new URL(url.trim());
    const ultimo = u.pathname.split("/").filter(Boolean).pop();
    if (ultimo && /\.[a-z0-9]{2,5}$/i.test(ultimo)) {
      return decodeURIComponent(ultimo).slice(0, 120);
    }
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

/** Nome de arquivo seguro pro caminho no bucket. */
export function caminhoSeguro(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "arquivo";
}

/** Lê a coluna jsonb sem confiar nela: linha antiga, nula ou torta vira []. */
export function lerAnexos(bruto: unknown): AnexoDemanda[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (a): a is AnexoDemanda =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as AnexoDemanda).id === "string" &&
      ((a as AnexoDemanda).tipo === "link" || (a as AnexoDemanda).tipo === "arquivo")
  );
}

export function humanizarTamanho(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Reexportado pra a tela não precisar conhecer dois módulos. */
export { MAX_UPLOAD_LABEL } from "./uploads";
