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
  /(dom[íi]nio|hospedagem|servidor|ftp|cpanel|wordpress|painel|e-?mail|registro\.br|godaddy|hostgator|hostinger|acessos?)/i;

/** Link que denuncia uma área administrativa — abre um contexto de acesso. */
const RE_URL_ADMIN =
  /(wp-admin|wp-login|\/admin\b|cpanel|webmail|painel\.|hostinger|hostgator)/i;

/**
 * Linha SOLTA que parece credencial — sem o rótulo "Login:"/"Senha:".
 *
 * Existe porque briefing real não segue o modelo. Na página da Thais Machado
 * a equipe colou o link do wp-admin e, embaixo, duas linhas cruas: o usuário
 * e a senha do WordPress dela. Sem isto, a senha entrava no CORPO do
 * documento — que pode ganhar link público.
 *
 * Só vale DENTRO de um contexto de acesso recém-aberto, e a régua é
 * deliberadamente frouxa: mandar uma linha inocente pro cofre de Acessos
 * (onde a equipe continua vendo) incomoda; deixar uma senha escapar pro link
 * público, não tem volta.
 */
function pareceCredencialSolta(t: string): boolean {
  const linha = t.trim();
  if (linha.length < 3 || linha.length > 60) return false;
  if (/^https?:\/\//i.test(linha)) return false;
  if (/[:：]\s*$/.test(linha)) return false;
  // Frase tem espaços e palavras; credencial, não.
  if (linha.split(/\s+/).length > 2) return false;
  const classes =
    Number(/[a-z]/.test(linha)) +
    Number(/[A-Z]/.test(linha)) +
    Number(/[0-9]/.test(linha)) +
    Number(/[^A-Za-z0-9\s]/.test(linha));
  // Cara de senha (3+ classes) ou de usuário (um token só, sem espaço).
  return classes >= 3 || !/\s/.test(linha);
}

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
  /**
   * Quantas linhas ainda podem ser credencial solta depois de um link de
   * área administrativa. Duas: o usuário e a senha, que é como a equipe
   * costuma colar. Passou disso, o contexto fecha — não sai varrendo o
   * documento inteiro.
   */
  let janelaSolta = 0;

  for (const bloco of blocks) {
    const texto = blockPlainText(bloco);

    if ((bloco as { type?: string }).type === "heading") {
      const achou = RE_CONTEXTO.exec(texto);
      if (achou) contexto = texto.trim();
      janelaSolta = 0;
      saida.push(bloco);
      continue;
    }

    // Link de wp-admin/cpanel: o que vem logo abaixo costuma ser o acesso.
    if (RE_URL_ADMIN.test(texto)) {
      contexto = texto.trim().slice(0, 80) || contexto;
      janelaSolta = 2;
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
        saida.push(avisoDeCofre());
        jaAvisou = true;
      }
      janelaSolta = 0;
      continue;
    }

    if (janelaSolta > 0 && pareceCredencialSolta(texto)) {
      janelaSolta -= 1;
      credenciais.push({
        contexto,
        rotulo: "acesso (sem rótulo no briefing)",
        valor: texto.trim(),
      });
      if (!jaAvisou) {
        saida.push(avisoDeCofre());
        jaAvisou = true;
      }
      continue;
    }
    if (texto.trim()) janelaSolta = 0;

    saida.push(bloco);
  }

  return { blocks: saida, credenciais };
}

/** Marca no corpo o lugar de onde a credencial saiu. */
function avisoDeCofre(): PartialBlock {
  return {
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
  } as unknown as PartialBlock;
}
