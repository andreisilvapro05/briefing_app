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
 * O prefixo tolerante não é capricho. A âncora `^\s*` deixava passar
 * `* Senha: …` e `- Login: …`, que é como o marcador de lista do ClickUp
 * chega quando a página vira markdown; e uma lista fechada de símbolos
 * ainda deixava passar `‼️ Senha: …` — uma página real (EI - Cury Vendas)
 * tinha a senha do cliente atrás de um emoji, e ela foi parar no CORPO do
 * documento, que pode ganhar link público.
 *
 * Então a régua virou: até 8 caracteres que NÃO são letra nem número antes
 * do rótulo. Emoji, bullet, seta, traço e aspas passam; texto não, porque
 * texto tem letra — "combinei a senha: depois eu mando" continua sendo
 * frase, não credencial.
 */
const RE_CREDENCIAL =
  /^[^\p{L}\p{N}\n]{0,8}(?:\*\*)?[^\p{L}\p{N}\n]{0,4}(senha|pass(?:word|wd)?|login|usu[áa]rio|user\s?name|user|e-?mail de acesso|acesso)[^\p{L}\p{N}\n]{0,4}[:：]\s*(.*)$/iu;

/**
 * Linha no formato "Rótulo: valor" que NÃO é credencial — um campo do
 * Modelo ("Paleta: Azul", "Prazo: 30/10", "Logo do cliente: enviado").
 *
 * Dentro do bloco "Dados de acesso …" a suspeita está invertida (toda linha
 * curta vira credencial), e a revisão de 22/09 mostrou o preço: rodando o
 * código real sobre uma EI no formato do Modelo, os campos seguintes ao de
 * acesso — paleta, tipografia, prazo, responsável — saíam do documento e
 * reapareciam no cofre como "acesso (sem rótulo)". Um campo rotulado que
 * não é de acesso é o sinal mais confiável de que o assunto mudou: ele
 * FECHA a região, além de não ser credencial.
 */
const RE_CAMPO_ROTULADO = /^[\s*\-•·>#]*(?:\*\*)?\s*([^:：]{2,40}?)(?:\*\*)?\s*[:：]\s*\S/;

/** Frase, não valor: termina em "?" ou tem cara de pergunta do briefing. */
const RE_PERGUNTA = /\?\s*$/;

/**
 * Tira o negrito/itálico que sobra do markdown em volta do valor.
 *
 * Os asteriscos e os espaços saem juntos: em `**Senha:** **valor**` o
 * fechamento do rótulo cai dentro do valor, e limpar em duas passadas
 * separadas deixava `**valor` — um asterisco colado na senha, que quem
 * fosse usar copiaria junto.
 */
function limparValor(v: string): string {
  // O "|" é a borda da célula quando a credencial veio numa tabela markdown.
  return v.replace(/^[\s*_`|]+/, "").replace(/[\s*_`|]+$/, "");
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
  const tokens = linha.split(/\s+/);
  // Frase tem espaços e palavras; credencial, não. Dentro de um bloco de
  // acesso a régua afrouxa um pouco — "joao.silva 2024" precisa passar —
  // mas não a ponto de engolir prosa: a revisão de 22/09 mostrou "Azul e
  // branco, algo clean" indo pro cofre com a régua de 5 palavras. Então:
  // até 3 tokens, e com mais de um, algum deles tem que ter dígito ou
  // símbolo. Frase de verdade quase nunca tem.
  if (tokens.length > (dentroDeRegiao ? 3 : 2)) return false;
  if (tokens.length > 1 && !tokens.some((tk) => /[0-9@._\-!#$%&*+=/\\]/.test(tk))) {
    return false;
  }
  // Uma palavra só, curta e sem nada além de letras ("Azul", "admin") é
  // resposta de briefing tanto quanto usuário — e usuário sem senha não é
  // segredo. Fica no corpo.
  if (tokens.length === 1 && linha.length < 6 && /^[A-Za-zÀ-ÿ]+$/.test(linha)) {
    return false;
  }
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
  /**
   * Linhas seguidas, dentro da região, que NÃO pareceram valor. Duas delas
   * fecham a região: se o texto voltou a ser prosa, o bloco de acesso
   * acabou mesmo que ninguém tenha posto um título depois — sem isso, uma
   * região aberta num parágrafo sem título nenhum abaixo engolia o
   * documento até o fim (medido na revisão: pergunta do briefing, Instagram,
   * e-mail e valor do projeto iam pro cofre).
   */
  let linhasSemValorNaRegiao = 0;

  for (const bloco of blocks) {
    const textoBruto = blockPlainText(bloco);
    const tipo = (bloco as { type?: string }).type;

    // Bloco de código multilinha: é como se cola um par login/senha, e a
    // regex de credencial não atravessa "\n". Se QUALQUER linha do bloco
    // for credencial, o bloco inteiro vai pro cofre — um codeBlock com senha
    // não tem parte aproveitável no corpo. Achado da revisão de 22/09.
    if (tipo === "codeBlock" && textoBruto.includes("\n")) {
      const linhas = textoBruto.split("\n");
      const achadas: CredencialItem[] = [];
      for (const linha of linhas) {
        const m = RE_CREDENCIAL.exec(linha);
        if (m && ehValorReal(m[2])) {
          achadas.push({ contexto, rotulo: m[1].trim(), valor: limparValor(m[2]) });
        } else if (regiaoAcesso && pareceCredencialSolta(linha, true)) {
          achadas.push({
            contexto,
            rotulo: "acesso (sem rótulo no briefing)",
            valor: linha.trim(),
          });
        }
      }
      if (achadas.length > 0) {
        credenciais.push(...achadas);
        if (!jaAvisou) {
          saida.push(avisoDeCofre());
          jaAvisou = true;
        }
        continue;
      }
      saida.push(bloco);
      continue;
    }

    const texto = textoBruto;

    // Título ou divisor fecham o bloco de acesso — é onde o assunto vira
    // outro. Sem esse fim, a varredura sairia comendo o documento inteiro.
    if (tipo === "heading" || tipo === "divider") {
      regiaoAcesso = RE_ABRE_BLOCO_ACESSO.test(texto);
      linhasSemValorNaRegiao = 0;
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
      // abre o bloco de acesso na maioria das páginas. Um sub-rótulo de
      // acesso ("Link da hospedagem:", "WordPress:") dentro de um bloco já
      // aberto MANTÉM a região: antes fechava, e as senhas soltas logo
      // abaixo ficavam no corpo.
      regiaoAcesso = regiaoAcesso || RE_ABRE_BLOCO_ACESSO.test(texto);
      linhasSemValorNaRegiao = 0;
      saida.push(bloco);
      continue;
    }

    // Um campo rotulado que não é de acesso ("Paleta: Azul", "Prazo: 30/10")
    // é o próximo item do Modelo: fecha o bloco de acesso e fica no corpo.
    if (regiaoAcesso && RE_CAMPO_ROTULADO.test(texto) && !RE_CREDENCIAL.test(texto)) {
      regiaoAcesso = false;
      linhasSemValorNaRegiao = 0;
      saida.push(bloco);
      continue;
    }

    // Dentro do bloco de acesso a janela não conta linhas: vale até o
    // próximo título ou divisor. Três pares de login+senha seguidos
    // (Filipe, KB Marketing, Clémerson) estouravam o limite de duas e a
    // terceira senha ficava no corpo.
    const solta =
      (regiaoAcesso || janelaSolta > 0) &&
      !RE_PERGUNTA.test(texto) &&
      pareceCredencialSolta(texto, regiaoAcesso);
    if (solta) {
      linhasSemValorNaRegiao = 0;
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
    if (texto.trim() && regiaoAcesso) {
      linhasSemValorNaRegiao += 1;
      if (linhasSemValorNaRegiao >= 2) {
        regiaoAcesso = false;
        linhasSemValorNaRegiao = 0;
      }
    }

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
