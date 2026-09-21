import type { PartialBlock } from "@blocknote/core";
import { blockPlainText } from "./markdown-to-blocks";

/**
 * O briefing do ClickUp tem um bloco "INFORMAÇÕES SOBRE DOMÍNIO E
 * HOSPEDAGEM" com `Login:` e `Senha:` em texto puro. Importar isso verbatim
 * jogaria credencial real de cliente dentro de um documento que passa a ter
 * link público compartilhável.
 *
 * Então na importação as credenciais saem do corpo e vão pra coluna
 * `ei_documents.credenciais`, que:
 *   - nunca é serializada na página pública;
 *   - só aparece pra quem tem acesso total (não pro papel "basico").
 *
 * No lugar delas fica um bloco avisando que existe credencial guardada —
 * a informação de que ELAS EXISTEM não é secreta e é útil pra equipe.
 */

export interface CredencialItem {
  /** "Domínio", "Hospedagem", "E-mail"… — derivado do contexto acima da linha. */
  contexto: string;
  rotulo: string;
  valor: string;
}

/** `Senha:`, `Login:`, `Usuário:`, `Senha do painel:` … */
const RE_CREDENCIAL =
  /^\s*(senha|password|login|usu[áa]rio|user|e-?mail de acesso|acesso)\s*:\s*(.*)$/i;

/** Cabeçalhos que definem o "contexto" de credenciais que vêm abaixo. */
const RE_CONTEXTO =
  /(dom[íi]nio|hospedagem|servidor|ftp|cpanel|wordpress|painel|e-?mail|registro\.br|godaddy|hostgator|hostinger)/i;

function ehValorReal(v: string): boolean {
  const t = v.trim();
  if (!t) return false;
  // Restos do modelo não preenchido.
  if (/^[-–—_.]+$/.test(t)) return false;
  if (/^(n\/?a|nao tem|não tem|sem|nenhum|a definir|-)$/i.test(t)) return false;
  return true;
}

export interface ExtracaoCredenciais {
  blocks: PartialBlock[];
  credenciais: CredencialItem[];
}

/**
 * Varre os blocos, retira os que carregam credencial preenchida e devolve
 * o documento limpo + a lista extraída. Linhas de credencial VAZIAS (o
 * modelo em branco) são mantidas no corpo — não são segredo e perder o
 * campo atrapalharia quem for preencher depois.
 */
export function extrairCredenciais(
  blocks: PartialBlock[]
): ExtracaoCredenciais {
  const credenciais: CredencialItem[] = [];
  const saida: PartialBlock[] = [];
  let contexto = "Acessos";
  let jaAvisou = false;

  for (const bloco of blocks) {
    const texto = blockPlainText(bloco);

    if ((bloco as { type?: string }).type === "heading") {
      const achou = RE_CONTEXTO.exec(texto);
      if (achou) contexto = texto.trim();
      saida.push(bloco);
      continue;
    }

    // Uma linha como "Link da hospedagem:" reposiciona o contexto sem ser
    // credencial ela mesma.
    if (!RE_CREDENCIAL.test(texto) && RE_CONTEXTO.test(texto) && /:\s*$/.test(texto)) {
      contexto = texto.replace(/:\s*$/, "").trim();
      saida.push(bloco);
      continue;
    }

    const m = RE_CREDENCIAL.exec(texto);
    if (m && ehValorReal(m[2])) {
      credenciais.push({
        contexto,
        rotulo: m[1].trim(),
        valor: m[2].trim(),
      });
      if (!jaAvisou) {
        saida.push({
          type: "paragraph",
          props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "yellow",
          },
          content: [
            {
              type: "text",
              text: "Credenciais deste briefing ficam guardadas em Acessos — visíveis só pra equipe com acesso total, nunca no link público.",
              styles: { italic: true },
            },
          ],
          children: [],
        } as unknown as PartialBlock);
        jaAvisou = true;
      }
      continue;
    }

    saida.push(bloco);
  }

  return { blocks: saida, credenciais };
}
