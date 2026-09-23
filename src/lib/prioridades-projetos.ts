import { TASK_STATUS_GROUP, type ProjectTask, type TaskStatus } from "./project-tasks";

/**
 * A matriz de PROJETOS: o que priorizar entre os clientes em andamento.
 *
 * Pedido da Karine (2026-09-22): "ter ali uma matriz na parte de projetos —
 * pode ser outra aba, mas organizar o que é mais importante priorizar".
 *
 * Diferente da matriz de iniciativas, aqui NINGUÉM digita nota. Os dois
 * eixos saem do que o app já sabe, porque pedir pra ela pontuar 24 projetos
 * à mão seria trocar um trabalho por outro:
 *
 *   urgência   = o quanto o prazo aperta (atrasado, vencendo, ou longe) +
 *                quanto tempo o projeto está sem atividade do cliente
 *   o que falta = quantas tarefas ainda estão abertas, em proporção
 *
 * A leitura dos quadrantes é direta:
 *   urgente + quase pronto → TERMINE AGORA (é uma entrega a um passo)
 *   urgente + longe        → PRECISA DE GENTE (não sai sozinho a tempo)
 *   sem pressa + quase pronto → fecha quando sobrar um vão
 *   sem pressa + longe     → é aqui que projeto apodrece; ou retoma, ou fecha
 */

export interface ProjetoNaMatriz {
  clientId: string;
  nome: string;
  tipo: string;
  status: string;
  /** 0–10. Quanto maior, mais o prazo aperta. */
  urgencia: number;
  /** 0–10. Quanto maior, mais trabalho falta. */
  falta: number;
  /** O que puxou a urgência pra cima — a frase que explica o ponto. */
  porque: string;
  abertas: number;
  total: number;
  /** Dias desde a última atividade do cliente. null = nunca houve. */
  diasParado: number | null;
  vencimentoMaisProximo: string | null;
}

/** Projeto travado há este tanto de dias já conta como urgente. */
const DIAS_PARADO_URGENTE = 14;

function nota(v: number): number {
  return Math.min(10, Math.max(0, Math.round(v)));
}

/**
 * Urgência a partir do prazo mais próximo entre as tarefas abertas.
 * Atrasado é 10; vencendo hoje, 9; e vai caindo conforme a data se afasta,
 * chegando a 2 num prazo de mais de um mês. Sem prazo nenhum começa em 3 —
 * não é urgente, mas também não é zero: projeto sem data é o que some.
 */
function urgenciaDoPrazo(vencimento: string | null, hoje: string): number {
  if (!vencimento) return 3;
  const a = new Date(`${vencimento}T12:00:00Z`).getTime();
  const b = new Date(`${hoje}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 3;
  const dias = Math.round((a - b) / 86_400_000);
  if (dias < 0) return 10;
  if (dias === 0) return 9;
  if (dias <= 2) return 8;
  if (dias <= 7) return 6;
  if (dias <= 14) return 5;
  if (dias <= 30) return 4;
  return 2;
}

export function montarMatrizProjetos(
  projetos: {
    id: string;
    nome: string;
    tipo: string;
    status: string;
    last_client_activity_at: string | null;
    created_at: string;
  }[],
  tarefas: ProjectTask[],
  hoje: string
): ProjetoNaMatriz[] {
  const porCliente = new Map<string, ProjectTask[]>();
  for (const t of tarefas) {
    if (!t.client_id) continue;
    const arr = porCliente.get(t.client_id);
    if (arr) arr.push(t);
    else porCliente.set(t.client_id, [t]);
  }

  return projetos
    // Projeto concluído ou entregue não entra: a matriz é sobre o que ainda
    // precisa de decisão.
    .filter((p) => TASK_STATUS_GROUP[p.status as TaskStatus] !== "fechado")
    .map((p) => {
      const doProjeto = porCliente.get(p.id) ?? [];
      const abertas = doProjeto.filter(
        (t) => TASK_STATUS_GROUP[t.status] !== "fechado"
      );
      const total = doProjeto.length;

      const prazos = abertas
        .map((t) => t.data_vencimento)
        .filter((d): d is string => Boolean(d))
        .sort();
      const maisProximo = prazos[0] ?? null;

      const ref = p.last_client_activity_at ?? p.created_at;
      const refMs = new Date(ref).getTime();
      const diasParado = Number.isFinite(refMs)
        ? Math.floor(
            (new Date(`${hoje}T12:00:00Z`).getTime() - refMs) / 86_400_000
          )
        : null;

      const doPrazo = urgenciaDoPrazo(maisProximo, hoje);
      // Projeto travado sobe na urgência mesmo sem prazo apertado: ele não
      // anda sozinho, e quanto mais tempo passa, pior fica a conversa.
      const doParado =
        diasParado !== null && diasParado >= DIAS_PARADO_URGENTE
          ? Math.min(3, Math.floor(diasParado / DIAS_PARADO_URGENTE))
          : 0;

      // Sem nenhuma tarefa gerada, "o que falta" é o projeto inteiro: não
      // dá pra dizer que está quase pronto quando ninguém sabe o que fazer.
      const falta = total === 0 ? 10 : nota((abertas.length / total) * 10);

      const porque =
        maisProximo && maisProximo < hoje
          ? "tem tarefa atrasada"
          : maisProximo === hoje
            ? "vence hoje"
            : doParado > 0
              ? `${diasParado} dias sem atividade do cliente`
              : maisProximo
                ? `próximo prazo em ${maisProximo}`
                : "sem prazo definido";

      return {
        clientId: p.id,
        nome: p.nome,
        tipo: p.tipo,
        status: p.status,
        urgencia: nota(doPrazo + doParado),
        falta,
        porque,
        abertas: abertas.length,
        total,
        diasParado,
        vencimentoMaisProximo: maisProximo,
      };
    });
}

/** O quadrante de um projeto — corte em 5, igual ao mapa de iniciativas. */
export function quadranteDoProjeto(p: {
  urgencia: number;
  falta: number;
}): "terminar" | "reforcar" | "folga" | "apodrecendo" {
  const urgente = p.urgencia >= 5;
  const longe = p.falta >= 5;
  if (urgente && !longe) return "terminar";
  if (urgente && longe) return "reforcar";
  if (!urgente && !longe) return "folga";
  return "apodrecendo";
}

export const QUADRANTES_PROJETO = [
  {
    id: "terminar" as const,
    titulo: "Termine agora",
    subtitulo: "aperta o prazo e falta pouco — é entrega a um passo",
    tom: "bg-emerald-50/70 border-emerald-200",
    texto: "text-emerald-900",
  },
  {
    id: "reforcar" as const,
    titulo: "Precisa de gente",
    subtitulo: "aperta o prazo e falta muito — não sai sozinho a tempo",
    tom: "bg-red-50/70 border-red-200",
    texto: "text-red-900",
  },
  {
    id: "folga" as const,
    titulo: "Fecha num vão",
    subtitulo: "falta pouco e não tem pressa",
    tom: "bg-sky-50/60 border-sky-200",
    texto: "text-sky-900",
  },
  {
    id: "apodrecendo" as const,
    titulo: "Ou retoma, ou fecha",
    subtitulo: "falta muito e ninguém está cobrando — é aqui que projeto apodrece",
    tom: "bg-fysi-cream border-fysi-line",
    texto: "text-fysi-muted",
  },
];
