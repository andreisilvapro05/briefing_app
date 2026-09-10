/**
 * Custos da empresa — só o que SAI. Nada de receita, nada de margem: a
 * ideia é fechar o mês sabendo quanto a empresa gastou, sem misturar com o
 * que entrou de projeto.
 */

export const CATEGORIAS_CUSTO = [
  { value: "equipe", label: "Equipe e salários", emoji: "👥" },
  { value: "ferramentas", label: "Ferramentas e assinaturas", emoji: "🧰" },
  { value: "anuncios", label: "Anúncios e tráfego", emoji: "📣" },
  { value: "terceiros", label: "Serviços de terceiros", emoji: "🤝" },
  { value: "equipamento", label: "Equipamentos", emoji: "🖥️" },
  { value: "impostos", label: "Impostos e taxas", emoji: "🧾" },
  { value: "outros", label: "Outros", emoji: "📦" },
] as const;

export const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS_CUSTO.map((c) => [c.value, c.label])
);
export const CATEGORIA_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIAS_CUSTO.map((c) => [c.value, c.emoji])
);

export interface CompanyCost {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  competencia: string;
  recorrente: boolean;
  fornecedor: string | null;
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
}

/** "2026-09" → "setembro de 2026" */
export function competenciaLabel(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes) return competencia;
  const nome = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.UTC(ano, mes - 1, 15)));
  return `${nome} de ${ano}`;
}

export function competenciaAtual(): string {
  const agora = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return agora.slice(0, 7);
}

/** Mês anterior a uma competência YYYY-MM. */
export function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes) return competencia;
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function competenciaSeguinte(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  if (!ano || !mes) return competencia;
  const d = new Date(Date.UTC(ano, mes, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function totalCustos(custos: CompanyCost[]): number {
  return custos.reduce((s, c) => s + Number(c.valor || 0), 0);
}

export function porCategoria(
  custos: CompanyCost[]
): { categoria: string; total: number; itens: CompanyCost[] }[] {
  const mapa = new Map<string, CompanyCost[]>();
  for (const c of custos) {
    const arr = mapa.get(c.categoria);
    if (arr) arr.push(c);
    else mapa.set(c.categoria, [c]);
  }
  return Array.from(mapa.entries())
    .map(([categoria, itens]) => ({
      categoria,
      total: totalCustos(itens),
      itens: itens.sort((a, b) => Number(b.valor) - Number(a.valor)),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface Reajuste {
  descricao: string;
  anterior: number;
  atual: number;
  diferenca: number;
  percentual: number;
}

/**
 * Reajuste silencioso: mesmo custo, valor maior que no mês anterior.
 *
 * É o ponto que motivou a tela — ferramenta que sobe de preço sem avisar.
 * "Hoje você paga R$500 na Claude; nada impede que no mês 11 seja R$587 — e
 * esse R$87 passa despercebido." Comparação por descrição normalizada
 * (minúscula, sem espaço sobrando), porque é assim que a pessoa relança o
 * mesmo item todo mês.
 */
export function detectarReajustes(
  atuais: CompanyCost[],
  anteriores: CompanyCost[]
): Reajuste[] {
  const chave = (d: string) => d.trim().toLowerCase();
  const antes = new Map<string, number>();
  for (const c of anteriores) {
    antes.set(chave(c.descricao), Number(c.valor || 0));
  }

  const reajustes: Reajuste[] = [];
  for (const c of atuais) {
    const anterior = antes.get(chave(c.descricao));
    if (anterior === undefined) continue;
    const atual = Number(c.valor || 0);
    // Centavo de diferença é ruído de arredondamento, não reajuste.
    if (atual - anterior <= 0.01) continue;
    reajustes.push({
      descricao: c.descricao,
      anterior,
      atual,
      diferenca: atual - anterior,
      percentual: anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0,
    });
  }
  return reajustes.sort((a, b) => b.diferenca - a.diferenca);
}
