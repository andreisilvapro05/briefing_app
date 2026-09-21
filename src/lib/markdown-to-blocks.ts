import type { PartialBlock } from "@blocknote/core";

/**
 * Markdown (como o ClickUp Docs devolve em `content_format=text/md`) →
 * blocos do BlockNote, o mesmo formato que `ei_documents.ei_data.blocks`
 * já guarda.
 *
 * Por que à mão e não `tryParseMarkdownToBlocks` do BlockNote: aquele roda
 * só no browser (precisa de uma instância de editor). A importação acontece
 * no servidor, então o conversor tem que ser puro.
 *
 * O objetivo aqui é FIDELIDADE: o briefing do ClickUp tem caixinhas
 * marcadas, divisores e links que carregam decisão real do cliente
 * ("- [x] Uma única cor no fundo (Mais clara)"). Perder isso vira de novo o
 * modelo vazio que já estava no app.
 */

type Styles = Record<string, boolean>;

interface InlineText {
  type: "text";
  text: string;
  styles: Styles;
}
interface InlineLink {
  type: "link";
  href: string;
  content: InlineText[];
}
type Inline = InlineText | InlineLink;

const BLOCK_PROPS = {
  textColor: "default",
  textAlignment: "left",
  backgroundColor: "default",
} as const;

/**
 * Desfaz os escapes que o ClickUp aplica no markdown (`drive\_link`,
 * `\+ inform.`). Sem isso o texto chega ao editor com barras sobrando.
 */
function unescapeMd(s: string): string {
  return s.replace(/\\([\\`*_{}[\]()#+\-.!~|])/g, "$1");
}

/**
 * Quebra uma linha em spans com estilo. Suporta `**negrito**`, `_itálico_`,
 * `` `código` `` e `[texto](url)`, que é o que aparece de fato nos
 * briefings — links do Drive, do Behance e do Google Meu Negócio.
 */
function parseInline(raw: string): Inline[] {
  const out: Inline[] = [];
  // Link primeiro: o texto interno pode conter ** e _, então ele tem que
  // ser recortado antes de qualquer marcação inline.
  const linkRe = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(raw))) {
    if (m.index > last) out.push(...parseStyled(raw.slice(last, m.index)));
    const label = unescapeMd(m[1]).trim();
    const href = unescapeMd(m[2]);
    out.push({
      type: "link",
      href,
      // ClickUp exporta muito link "pelado" (`[url](url)`). Mostrar a URL
      // inteira como rótulo polui; mantém o rótulo quando ele é diferente.
      content: [{ type: "text", text: label || href, styles: {} }],
    });
    last = m.index + m[0].length;
  }
  if (last < raw.length) out.push(...parseStyled(raw.slice(last)));
  return out.filter((n) => n.type === "link" || n.text.length > 0);
}

function parseStyled(raw: string, herdado: Styles = {}): InlineText[] {
  const out: InlineText[] = [];
  // Ordem importa: ** antes de *, __ antes de _.
  const re = /(\*\*\*|___)([\s\S]+?)\1|(\*\*|__)([\s\S]+?)\3|(\*|_)([\s\S]+?)\5|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;

  const push = (text: string, styles: Styles) => {
    const t = unescapeMd(text);
    if (t) out.push({ type: "text", text: t, styles: { ...herdado, ...styles } });
  };

  while ((m = re.exec(raw))) {
    if (m.index > last) push(raw.slice(last, m.index), {});
    // Recursivo: o ClickUp escreve `**_é mais para..._**` (negrito por fora,
    // itálico por dentro). Sem recursão o marcador interno vazava como texto.
    if (m[2] !== undefined)
      out.push(...parseStyled(m[2], { ...herdado, bold: true, italic: true }));
    else if (m[4] !== undefined)
      out.push(...parseStyled(m[4], { ...herdado, bold: true }));
    else if (m[6] !== undefined)
      out.push(...parseStyled(m[6], { ...herdado, italic: true }));
    else if (m[7] !== undefined) push(m[7], { code: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length) push(raw.slice(last), {});
  return out;
}

function textBlock(
  type: "paragraph" | "bulletListItem" | "numberedListItem",
  raw: string
): PartialBlock {
  return {
    type,
    props: { ...BLOCK_PROPS },
    content: parseInline(raw) as PartialBlock["content"],
    children: [],
  } as PartialBlock;
}

/** `### **Título**` → heading 3 com o texto limpo (sem os `**` do ClickUp). */
function headingBlock(level: number, raw: string): PartialBlock {
  return {
    type: "heading",
    props: {
      level: Math.min(3, Math.max(1, level)) as 1 | 2 | 3,
      isToggleable: false,
      ...BLOCK_PROPS,
    },
    content: parseInline(raw) as PartialBlock["content"],
    children: [],
  } as unknown as PartialBlock;
}

const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_CHECK = /^[-*+]\s+\[([ xX])\]\s*(.*)$/;
// ClickUp usa `*   `, `- `, e também o bullet literal `•⁠ ⁠` (com U+2060).
const RE_BULLET = /^(?:[-*+]|•)[\s⁠ ]+(.*)$/;
// `\s*` e não `\s+`: o modelo do ClickUp deixa "1.", "2.", "3." em branco
// como espaço a preencher. Virar parágrafo solto perderia a lista.
const RE_NUMBER = /^(\d+)[.)]\s*(.*)$/;
const RE_DIVIDER = /^\s*(?:\*\s*\*\s*\*|-{3,}|_{3,})\s*$/;
const RE_IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const RE_QUOTE = /^>\s?(.*)$/;

/**
 * Converte o markdown inteiro. Linhas em branco viram separação natural
 * entre blocos (não viram parágrafo vazio) — exceto quando estão dentro de
 * um bloco de código.
 */
export function markdownToBlocks(md: string): PartialBlock[] {
  const blocks: PartialBlock[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inCode = false;
  let codeBuf: string[] = [];

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (inCode) {
        blocks.push({
          type: "codeBlock",
          props: { language: "text" },
          content: [
            { type: "text", text: codeBuf.join("\n"), styles: {} },
          ] as PartialBlock["content"],
          children: [],
        } as unknown as PartialBlock);
        codeBuf = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const t = line.trim();
    if (!t) continue;

    if (RE_DIVIDER.test(t)) {
      blocks.push({ type: "divider", props: {}, children: [] } as unknown as PartialBlock);
      continue;
    }

    const img = RE_IMAGE.exec(t);
    if (img) {
      blocks.push({
        type: "image",
        props: { url: img[2], caption: unescapeMd(img[1]), previewWidth: 512 },
        children: [],
      } as unknown as PartialBlock);
      continue;
    }

    const h = RE_HEADING.exec(t);
    if (h) {
      blocks.push(headingBlock(h[1].length, h[2]));
      continue;
    }

    // Checklist ANTES de bullet — `- [x] foo` também casa com RE_BULLET.
    const c = RE_CHECK.exec(t);
    if (c) {
      blocks.push({
        type: "checkListItem",
        props: { checked: c[1].toLowerCase() === "x", ...BLOCK_PROPS },
        content: parseInline(c[2]) as PartialBlock["content"],
        children: [],
      } as unknown as PartialBlock);
      continue;
    }

    const q = RE_QUOTE.exec(t);
    if (q) {
      blocks.push(textBlock("paragraph", q[1]));
      continue;
    }

    const n = RE_NUMBER.exec(t);
    if (n) {
      // "1." sozinho é item vazio do modelo (campo não preenchido);
      // mantém como numberedListItem pra não perder a estrutura da lista.
      blocks.push(textBlock("numberedListItem", n[2]));
      continue;
    }

    const b = RE_BULLET.exec(t);
    if (b) {
      blocks.push(textBlock("bulletListItem", b[1]));
      continue;
    }

    blocks.push(textBlock("paragraph", t));
  }

  // Documento vazio ainda precisa de um parágrafo — o BlockNote não monta
  // o editor com lista de blocos vazia.
  if (blocks.length === 0) {
    blocks.push(textBlock("paragraph", ""));
  }
  return blocks;
}

/** Texto corrido de um bloco — usado pela busca e pela detecção de credenciais. */
export function blockPlainText(block: PartialBlock): string {
  const content = (block as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((node) => {
      const n = node as { type?: string; text?: string; content?: unknown };
      if (n.type === "link" && Array.isArray(n.content)) {
        return (n.content as { text?: string }[])
          .map((c) => c.text ?? "")
          .join("");
      }
      return n.text ?? "";
    })
    .join("");
}
