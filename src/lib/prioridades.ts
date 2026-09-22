/**
 * Iniciativas de melhoria — tipos, listas e regras CLIENT-SAFE.
 *
 * Este módulo NÃO importa nada de server (mesma regra de `materiais-cliente.ts`),
 * porque o gráfico e a lista são Client Components e as Server Actions usam as
 * MESMAS funções pra decidir quadrante e vizinho de ordenação. Quem lê o banco
 * é `prioridades-server.ts`.
 *
 * A entidade aqui não é tarefa: é o que a agência pode FAZER pra ganhar tempo
 * ou dinheiro ("onboarding", "encurtar o prazo do design"). Ver a migration
 * 20260922170000_iniciativas_de_melhoria.sql.
 */

/* -------------------------------------------------------------------------- */
/* Frentes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Frente da operação que a iniciativa melhora. Lista PRÓPRIA desta tela: de
 * propósito não reusa `AREAS` de `project-tasks.ts`, que é a gaveta das
 * demandas internas — lá o recorte é "de quem é a demanda", aqui é "qual
 * parte do negócio melhora". Misturar as duas faria mexer numa quebrar a outra.
 *
 * Os valores saem das audiências que a Karine citou: ela e a Tainá
 * (comercial, atendimento e marketing) e o Andrei (processos e gestão), mais
 * a produção do projeto em si (copy e design).
 */
export type Frente =
  | "producao"
  | "comercial"
  | "atendimento"
  | "marketing"
  | "processos";

export interface FrenteDef {
  value: Frente;
  label: string;
  /** Cor do ponto no gráfico. Hex porque vai em atributo de SVG. */
  cor: string;
  /** Uma linha do que entra nesta frente. */
  descricao: string;
}

export const FRENTES: FrenteDef[] = [
  {
    value: "producao",
    label: "Produção",
    cor: "#1F6FB2",
    descricao: "Copy, design e implementação — o que faz o projeto andar.",
  },
  {
    value: "comercial",
    label: "Comercial",
    cor: "#B3541E",
    descricao: "Proposta, negociação e fechamento.",
  },
  {
    value: "atendimento",
    label: "Atendimento",
    cor: "#2E8B6F",
    descricao: "A relação com o cliente durante o projeto.",
  },
  {
    value: "marketing",
    label: "Marketing",
    cor: "#7A3FA8",
    descricao: "Conteúdo, audiência e anúncios da própria agência.",
  },
  {
    value: "processos",
    label: "Processos e gestão",
    cor: "#A0173F",
    descricao: "Como a agência se organiza por dentro.",
  },
];

export const FRENTE_VALUES: Frente[] = FRENTES.map((f) => f.value);

export function frenteDef(frente: Frente): FrenteDef {
  return FRENTES.find((f) => f.value === frente) ?? FRENTES[0];
}

export function normalizarFrente(v: unknown): Frente {
  return FRENTE_VALUES.includes(v as Frente) ? (v as Frente) : "producao";
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

export type StatusIniciativa = "ideia" | "fazendo" | "feito";

export const STATUS_INICIATIVA: {
  value: StatusIniciativa;
  label: string;
  /** Classe da etiqueta na lista. */
  tom: string;
}[] = [
  {
    value: "ideia",
    label: "Ideia",
    tom: "bg-fysi-cream text-fysi-muted border border-fysi-line",
  },
  {
    value: "fazendo",
    label: "Fazendo",
    tom: "bg-fysi-yellow text-fysi-deep",
  },
  {
    value: "feito",
    label: "Feito",
    tom: "bg-fysi-mint text-fysi-deep",
  },
];

export function normalizarStatus(v: unknown): StatusIniciativa {
  return v === "fazendo" || v === "feito" ? v : "ideia";
}

/** Garante inteiro 0–10 — os dois eixos do gráfico. */
export function normalizarNota(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(0, n));
}

/* -------------------------------------------------------------------------- */
/* A iniciativa                                                                */
/* -------------------------------------------------------------------------- */

export interface Iniciativa {
  id: string;
  titulo: string;
  detalhe: string | null;
  frente: Frente;
  /** 0–10. Quanto muda a operação. */
  impacto: number;
  /** 0–10. Quanto custa construir. */
  esforco: number;
  /** Uma linha: "-3 dias no projeto", "mais projetos fechados/mês". */
  ganho: string | null;
  /** Valor de TEAM_MEMBERS (taina, valeria, karine, andrei) ou null. */
  responsavel: string | null;
  status: StatusIniciativa;
  ordem: number;
}

/* -------------------------------------------------------------------------- */
/* Quadrantes                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Onde as linhas tracejadas cortam os dois eixos. Acima de 5 é "alto" nos
 * dois — então 5 conta como BAIXO, e um ponto exatamente em (5,5) cai em
 * "Filler". É arbitrário, mas precisa ser explícito: sem a regra escrita, o
 * ponto em cima da linha ia parar num quadrante no gráfico e em outro na
 * lista.
 */
export const CORTE = 5;

export type QuadranteId = "quick-win" | "moonshot" | "filler" | "evitar";

export interface QuadranteDef {
  id: QuadranteId;
  /** Nome curto, como no gráfico. */
  nome: string;
  /** A chamada que vem depois do ponto: "comece aqui". */
  chamada: string;
  /** Uma linha explicando o que significa cair aqui. */
  descricao: string;
  /** Classe da etiqueta do grupo na lista. */
  tom: string;
  /** Cor do rótulo dentro do gráfico (hex, vai em atributo de SVG). */
  corRotulo: string;
}

/** Ordem canônica da tela: quick win primeiro, como a dona pediu. */
export const QUADRANTES: QuadranteDef[] = [
  {
    id: "quick-win",
    nome: "Quick win",
    chamada: "comece aqui",
    descricao: "Muda muito e custa pouco. É por onde se começa.",
    tom: "bg-fysi-mint text-fysi-deep",
    corRotulo: "#2E8B6F",
  },
  {
    id: "moonshot",
    nome: "Moonshot",
    chamada: "estratégico",
    descricao: "Muda muito, mas custa caro. Precisa de espaço na agenda.",
    tom: "bg-fysi-yellow text-fysi-deep",
    corRotulo: "#B3541E",
  },
  {
    id: "filler",
    nome: "Filler",
    chamada: "talvez depois",
    descricao: "Custa pouco, mas muda pouco. Entra em janela vaga.",
    tom: "bg-fysi-cream text-fysi-muted border border-fysi-line",
    corRotulo: "#6B7472",
  },
  {
    id: "evitar",
    nome: "Evitar",
    chamada: "não agora",
    descricao: "Custa caro e muda pouco. Só se algo mudar a conta.",
    tom: "bg-fysi-cream text-fysi-muted border border-fysi-line",
    corRotulo: "#A0173F",
  },
];

export function quadranteDef(id: QuadranteId): QuadranteDef {
  return QUADRANTES.find((q) => q.id === id) ?? QUADRANTES[0];
}

export function quadranteDe(i: {
  impacto: number;
  esforco: number;
}): QuadranteId {
  const altoImpacto = i.impacto > CORTE;
  const altoEsforco = i.esforco > CORTE;
  if (altoImpacto) return altoEsforco ? "moonshot" : "quick-win";
  return altoEsforco ? "evitar" : "filler";
}

/* -------------------------------------------------------------------------- */
/* Agrupamento e numeração                                                     */
/* -------------------------------------------------------------------------- */

/**
 * O grupo em que a iniciativa aparece na lista — e dentro do qual as setas
 * ↑↓ reordenam. "feito" é grupo próprio: o que já foi feito não é mais um
 * lugar pra investir esforço, então sai do meio das quatro decisões.
 */
export type GrupoId = QuadranteId | "feito";

export function grupoDe(i: {
  impacto: number;
  esforco: number;
  status: StatusIniciativa;
}): GrupoId {
  return i.status === "feito" ? "feito" : quadranteDe(i);
}

export const GRUPOS_ORDEM: GrupoId[] = [
  ...QUADRANTES.map((q) => q.id),
  "feito",
];

export interface IniciativaNoMapa extends Iniciativa {
  /** O número desenhado dentro do ponto — e que abre a linha na lista. */
  numero: number;
  quadrante: QuadranteId;
  grupo: GrupoId;
}

/**
 * Ordena tudo e numera 1..N na MESMA sequência em que a lista aparece:
 * quadrante por quadrante (quick win primeiro), feitos no fim. O número é a
 * ponte entre o ponto no gráfico e a linha embaixo — por isso é calculado
 * sobre a lista INTEIRA, antes de qualquer filtro de frente. Isolar uma
 * frente não renumera nada; o #3 continua sendo o #3.
 */
export function montarMapa(itens: Iniciativa[]): IniciativaNoMapa[] {
  const comGrupo = itens.map((i) => ({
    ...i,
    quadrante: quadranteDe(i),
    grupo: grupoDe(i),
  }));
  const ordenado = GRUPOS_ORDEM.flatMap((g) =>
    comGrupo
      .filter((i) => i.grupo === g)
      .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"))
  );
  return ordenado.map((i, idx) => ({ ...i, numero: idx + 1 }));
}

/** Os grupos na ordem da tela, já sem os vazios. */
export function agruparPorGrupo(
  mapa: IniciativaNoMapa[]
): { grupo: GrupoId; itens: IniciativaNoMapa[] }[] {
  return GRUPOS_ORDEM.map((grupo) => ({
    grupo,
    itens: mapa.filter((i) => i.grupo === grupo),
  })).filter((g) => g.itens.length > 0);
}

export function rotuloDoGrupo(grupo: GrupoId): {
  nome: string;
  chamada: string;
  descricao: string;
  tom: string;
} {
  if (grupo === "feito") {
    return {
      nome: "Já feito",
      chamada: "fora do mapa",
      descricao: "Continua no gráfico, apagado, pra ninguém propor de novo.",
      tom: "bg-fysi-mint text-fysi-deep",
    };
  }
  const q = quadranteDef(grupo);
  return {
    nome: q.nome,
    chamada: q.chamada,
    descricao: q.descricao,
    tom: q.tom,
  };
}
