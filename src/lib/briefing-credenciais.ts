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

/**
 * `Senha:`, `Login:`, `Usuário:`, `Senha do painel:` …
 *
 * O prefixo tolerante não é capricho: a âncora `^\s*` deixava passar
 * `* Senha: …` e `- Login: …`, que é como o marcador de lista do ClickUp
 * chega quando a página vira markdown. Uma página real (EI - Gustavo
 * Vicelli) começava com `"* "` e a senha ia inteira pro corpo do documento.
 * Aqui só se tolera lixo de formatação — bullet, traço, citação, negrito —
 * nunca texto, senão "combinei a senha: depois eu mando" viraria credencial.
 */
const RE_CREDENCIAL =
  /^[\s*\-•·>#]*(?:\*\*)?\s*(senha|password|login|usu[áa]rio|user|e-?mail de acesso|acesso)(?:\*\*)?\s*:\s*(.*)$/i;

/**
 * Tira o negrito/itálico que sobra do markdown em volta do valor.
 *
 * Os asteriscos e os espaços saem juntos: em `**Senha:** **valor**` o
 * fechamento do rótulo cai dentro do valor, e limpar em duas passadas
 * separadas deixava `**valor` — um asterisco colado na senha, que quem
 * fosse usar copiaria junto.
 */
function limparValor(v: string): string {
  return v.replace(/^[\s*_`]+/, "").replace(/[\s*_`]+$/, "");
}

/** Cabeçalhos que definem o "contexto" de credenciais que vêm abaixo. */
const RE_CONTEXTO =
  /(dom[íi]nio|hospedagem|servidor|ftp|cpanel|wordpress|painel|e-?mail|registro\.br|godaddy|hostgator|hostinger|acessos?)/i;

/**
 * Cabeçalho que declara um BLOCO de acesso inteiro — não um campo só.
 *
 * O primeiro item do Modelo de EI é literalmente "Dados de acesso
 * domínio/hospedagem/wordpress:", e a medição sobre 429 páginas do ClickUp
 * mostrou que em cerca de metade delas a credencial aparece como linha
 * solta, sem rótulo nenhum (uma página tem nove seguidas). Nenhuma regex de
 * palavra-chave alcança isso.
 *
 * Então, dentro desse bloco, a suspeita se inverte: tudo que tem cara de
 * valor vai pro cofre até o próximo título ou divisor. Mandar um apelido
 * inocente pro cofre de Acessos incomoda — a equipe continua vendo. Deixar
 * uma senha de cliente no corpo do documento, que pode ganhar link público,
 * não tem volta.
 */
const RE_ABRE_BLOCO_ACESSO =
  /(dados\s+de\s+acesso|credenciais|logins?\s+e\s+senhas?|^acessos?\b)/i;

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
function pareceCredencialSolta(t: string, dentroDeRegiao = false): boolean {
  const linha = t.trim();
  const limite = dentroDeRegiao ? 80 : 60;
  if (linha.length < 3 || linha.length > limite) return false;
  if (/^https?:\/\//i.test(linha)) return false;
  if (/[:：]\s*$/.test(linha)) return false;
  // Frase tem espaços e palavras; credencial, não. Dentro de um bloco de
  // acesso a régua afrouxa: lá a linha crua é a regra, não a exceção, e
  // "joao.silva 2024" ou "usuario admin" precisam passar.
  if (linha.split(/\s+/).length > (dentroDeRegiao ? 5 : 2)) return false;
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
  /**
   * Dentro de um bloco "Dados de acesso …", toda linha com cara de valor é
   * tratada como credencial, até o próximo título ou divisor. Ver
   * RE_ABRE_BLOCO_ACESSO pro porquê.
   */
  let regiaoAcesso = false;

  for (const bloco of blocks) {
    const texto = blockPlainText(bloco);
    const tipo = (bloco as { type?: string }).type;

    // Título ou divisor fecham o bloco de acesso — é onde o assunto vira
    // outro. Sem esse fim, a varredura sairia comendo o documento inteiro.
    if (tipo === "heading" || tipo === "divider") {
      regiaoAcesso = RE_ABRE_BLOCO_ACESSO.test(texto);
      if (regiaoAcesso) contexto = texto.trim() || contexto;
    }

    // A credencial é testada ANTES do tipo do bloco. Antes, `heading` era
    // empurrado pra saída sem nunca passar por aqui, e uma página real
    // (EI - Araya) trazia a senha dentro de um título — que ia inteira pro
    // corpo do documento, o mesmo corpo que pode ganhar link público.
    const mAqui = RE_CREDENCIAL.exec(texto);
    if (mAqui && ehValorReal(mAqui[2])) {
      credenciais.push({
        contexto,
        rotulo: mAqui[1].trim(),
        valor: limparValor(mAqui[2]),
      });
      if (!jaAvisou) {
        saida.push(avisoDeCofre());
        jaAvisou = true;
      }
      janelaSolta = 0;
      continue;
    }

    if (tipo === "heading") {
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
      // No Modelo de EI esse campo é parágrafo, não título — e é ele que
      // abre o bloco de acesso na maioria das páginas.
      regiaoAcesso = RE_ABRE_BLOCO_ACESSO.test(texto);
      saida.push(bloco);
      continue;
    }

    // Dentro do bloco de acesso a janela não conta linhas: vale até o
    // próximo título ou divisor. Três pares de login+senha seguidos
    // (Filipe, KB Marketing, Clémerson) estouravam o limite de duas e a
    // terceira senha ficava no corpo.
    const solta =
      (regiaoAcesso || janelaSolta > 0) &&
      pareceCredencialSolta(texto, regiaoAcesso);
    if (solta) {
      if (!regiaoAcesso) janelaSolta -= 1;
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
    if (texto.trim() && !regiaoAcesso) janelaSolta = 0;

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
