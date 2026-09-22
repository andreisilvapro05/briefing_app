/**
 * "O que o cliente precisa nos enviar" — tipos e constantes CLIENT-SAFE.
 *
 * Este módulo NÃO importa nada de server (mesma regra de `custom-questions.ts`),
 * pra poder ser usado tanto pelo painel do admin quanto pela página pública do
 * briefing. Quem lê/escreve no banco é `materiais-cliente-server.ts`.
 *
 * Pedido da Karine (2026-09-22): depois do briefing preenchido sempre sobra o
 * material que só o cliente pode fornecer. Hoje isso é combinado no WhatsApp
 * e some. Aqui vira lista: a equipe edita e ordena, o cliente marca o que já
 * mandou pelo link público do briefing, a equipe confirma o recebimento.
 */

export type MaterialStatus = "pendente" | "enviado" | "nao_se_aplica";

export interface MaterialItem {
  id: string;
  clientId: string;
  titulo: string;
  instrucao: string | null;
  ordem: number;
  status: MaterialStatus;
  /** 'cliente' (marcou pelo link público) ou o nome de quem da equipe marcou. */
  marcadoPor: string | null;
  marcadoEm: string | null;
  /** "Mandei no WhatsApp", link de pasta do Drive, etc. */
  recadoDoCliente: string | null;
  /** Quando a EQUIPE confirmou que chegou. Nulo + status enviado = a conferir. */
  conferidoEm: string | null;
  conferidoPor: string | null;
}

/** Valor gravado em `marcado_por` quando quem marcou foi o próprio cliente. */
export const MARCADO_PELO_CLIENTE = "cliente";

export const STATUS_LABEL: Record<MaterialStatus, string> = {
  pendente: "Falta enviar",
  enviado: "Enviado",
  nao_se_aplica: "Não se aplica",
};

/**
 * Lista padrão sugerida — pra ninguém começar do zero. São os itens que
 * travam landing page e site na prática. A equipe pode editar, reordenar,
 * remover e acrescentar depois de semear.
 */
export const MATERIAIS_PADRAO: { titulo: string; instrucao: string }[] = [
  {
    titulo: "Logo em vetor",
    instrucao:
      "O arquivo original da sua marca: .ai, .svg, .eps ou .pdf editável. Foto ou print da logo não serve — fica serrilhada quando a gente amplia.",
  },
  {
    titulo: "Fotos",
    instrucao:
      "Fotos suas, da equipe, do espaço ou dos produtos, na maior qualidade que você tiver. Se tiver ensaio profissional, mande a pasta inteira.",
  },
  {
    titulo: "Textos",
    instrucao:
      "O que você já tem escrito e quer que apareça: sobre você, descrição dos serviços, perguntas frequentes. Pode ser rascunho — a gente ajusta.",
  },
  {
    titulo: "Depoimentos de clientes",
    instrucao:
      "Prints de conversa, avaliações do Google ou textos com o nome de quem falou. Três já dão um bom bloco de prova social.",
  },
  {
    titulo: "Acesso ao domínio",
    instrucao:
      "Onde o endereço do site foi registrado (Registro.br, GoDaddy, Hostinger…) e o login. Sem isso o site não vai pro ar no seu endereço.",
  },
  {
    titulo: "Acesso à hospedagem / WordPress",
    instrucao:
      "Login do painel da hospedagem e, se já existir site, do WordPress. Se não tiver nenhum ainda, marque “não se aplica” que a gente resolve.",
  },
  {
    titulo: "CNPJ e razão social",
    instrucao:
      "Pro rodapé do site. Se você não tem CNPJ, mande nome completo — é o que vai no lugar.",
  },
  {
    titulo: "Links das redes sociais",
    instrucao:
      "Instagram, WhatsApp, LinkedIn, YouTube — os que devem aparecer no site. Mande o link completo, não só o @.",
  },
];

export interface ResumoMateriais {
  /** Itens que valem (exclui “não se aplica”). */
  total: number;
  /** Ainda não enviados. */
  faltam: number;
  /** Marcados como enviados (conferidos ou não). */
  enviados: number;
  /** O cliente disse que mandou, mas ninguém da equipe conferiu ainda. */
  aConferir: number;
  naoSeAplica: number;
}

export function resumirMateriais(itens: MaterialItem[]): ResumoMateriais {
  let faltam = 0;
  let enviados = 0;
  let aConferir = 0;
  let naoSeAplica = 0;
  for (const i of itens) {
    if (i.status === "nao_se_aplica") {
      naoSeAplica += 1;
      continue;
    }
    if (i.status === "enviado") {
      enviados += 1;
      if (!i.conferidoEm) aConferir += 1;
      continue;
    }
    faltam += 1;
  }
  return { total: faltam + enviados, faltam, enviados, aConferir, naoSeAplica };
}

/** "faltam 3 de 8" — a frase que a Karine pediu pra bater o olho e entender. */
export function fraseResumo(r: ResumoMateriais): string {
  if (r.total === 0) return "Sem itens na lista";
  if (r.faltam === 0) return `Tudo enviado (${r.enviados} de ${r.total})`;
  return `${r.faltam === 1 ? "falta 1" : `faltam ${r.faltam}`} de ${r.total}`;
}
