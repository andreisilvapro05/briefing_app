import { dataValida, formatDataCompleta } from "./datas";
import {
  DEFAULT_TASK_STATUS,
  TASK_STATUS_OPTIONS,
  isClosedTaskStatus,
  type TaskStatus,
} from "./project-tasks";

/**
 * Ata de acompanhamento — as regras puras, sem servidor nenhum.
 *
 * Karine (04/10), pelo Andrei (gestor de projetos): "ter uma parte de ata
 * para o Andrei usar, ele quer que tenha: nome cliente / status que está /
 * campo para observacao / campo para anexar algo escrito como um google
 * docs, mas melhorado / e quando ele muda o status do cliente para
 * finalizado some dali. precisa ter os documentos por datas".
 *
 * Duas coisas moram aqui porque são as que mais fácil se quebram em
 * silêncio e as que o teste pega: QUEM sai da visão principal (e por quê)
 * e COMO as atas se agrupam por data. O resto — consultar, escrever — está
 * em `atas-server.ts`.
 *
 * Guardado como `kind = 'ata'` em `ei_documents`; o porquê está na
 * migration 20261004120000.
 */

/**
 * UM CLIENTE dentro de uma ata.
 *
 * Karine (05/10): "a parte de ata não é pra ser individual de cada
 * cliente, e sim tudo num documento só, poder puxar todos os clientes
 * dentro de um mesmo documento". O gesto real do Andrei é sentar uma vez
 * (a reunião) e passar por todos os projetos — uma ata por cliente
 * obrigaria a abrir 24 documentos pra fazer a reunião de uma semana.
 */
export interface LinhaDaAta {
  id: string;
  clientId: string;
  /** Nome que se lê na linha — ver `nomeDoClienteDaAta`. */
  cliente: string;
  /**
   * `clients.status` lido na hora. Não há cópia do status na ata de
   * propósito: duas cópias divergem no dia em que o sync do ClickUp mexer
   * numa e não na outra — e é isso que faz "mudou pra finalizado, some
   * dali" funcionar sem escrita nenhuma.
   */
  statusProjeto: TaskStatus;
  observacao: string | null;
  ordem: number;
  /** O PROJETO foi arquivado (desistência) — `clients.arquivado_em`. */
  projetoArquivado: boolean;
}

/** Uma ata: a REUNIÃO de uma data, com vários clientes dentro. */
export interface AtaResumo {
  id: string;
  /** O que a pessoa escreveu no topo ("Reunião de segunda"). */
  titulo: string;
  /** Dia da ata, YYYY-MM-DD (ver `dataDaAta`). */
  data: string;
  atualizadoEm: string;
  /** Arquivada À MÃO (`ei_documents.arquivado`). */
  arquivada: boolean;
  linhas: LinhaDaAta[];
}

/**
 * Por que esta ata não está na visão principal. `null` = está.
 *
 * São três motivos diferentes e a tela precisa distinguí-los: "finalizado"
 * é o pedido do Andrei (o projeto acabou bem), "projeto-arquivado" é
 * desistência, e "manual" foi decisão de alguém. Um booleano só diria que
 * a ata sumiu, sem dizer o que fazer a respeito.
 */
export type MotivoDeArquivo = "manual" | "projeto-arquivado" | "finalizado";

export const MOTIVO_LABEL: Record<MotivoDeArquivo, string> = {
  manual: "Arquivada à mão",
  "projeto-arquivado": "Projeto arquivado",
  finalizado: "Projeto finalizado",
};

/**
 * Por que ESTA LINHA saiu da visão principal da ata. `null` = está nela.
 *
 * O pedido, literal: "quando ele muda o status do cliente para finalizado
 * some dali". "Finalizado" aqui é o grupo "fechado" da taxonomia
 * (Concluído e Completo | Entregue) — ver project-tasks.ts.
 *
 * Projeto arquivado (desistência) sai pelo mesmo motivo prático, mas é um
 * motivo DIFERENTE, e a tela precisa distinguir: um acabou bem, o outro
 * não vai acontecer.
 */
export function motivoDeArquivo(l: LinhaDaAta): MotivoDeArquivo | null {
  if (l.projetoArquivado) return "projeto-arquivado";
  if (isClosedTaskStatus(l.statusProjeto)) return "finalizado";
  return null;
}

export interface SeparacaoDeLinhas {
  /** O que o Andrei vê quando abre a ata. */
  ativas: LinhaDaAta[];
  /** Nada foi apagado: segue visível, recolhido, no fim da ata. */
  encerradas: LinhaDaAta[];
}

/**
 * Parte as linhas de UMA ata entre "em andamento" e "encerradas", na
 * ordem em que foram postas na ata.
 *
 * As encerradas continuam existindo: a ata é registro do que foi dito
 * naquela reunião, e apagar a linha de um projeto que terminou reescreve
 * o passado.
 */
export function separarLinhas(linhas: LinhaDaAta[]): SeparacaoDeLinhas {
  const ativas: LinhaDaAta[] = [];
  const encerradas: LinhaDaAta[] = [];
  for (const l of [...linhas].sort((x, y) => x.ordem - y.ordem)) {
    (motivoDeArquivo(l) === null ? ativas : encerradas).push(l);
  }
  return { ativas, encerradas };
}

export interface SeparacaoDeAtas {
  ativas: AtaResumo[];
  /** Arquivadas à mão. */
  arquivadas: AtaResumo[];
}

/** Parte as atas entre as da visão principal e as arquivadas à mão. */
export function separarAtas(atas: AtaResumo[]): SeparacaoDeAtas {
  const ativas: AtaResumo[] = [];
  const arquivadas: AtaResumo[] = [];
  for (const a of atas) (a.arquivada ? arquivadas : ativas).push(a);
  return { ativas: ordenarPorData(ativas), arquivadas: ordenarPorData(arquivadas) };
}

/** Quantos clientes a ata ainda acompanha — o que se lê na lista. */
export function contarAtivas(a: AtaResumo): number {
  return separarLinhas(a.linhas).ativas.length;
}

/**
 * Mais recente primeiro. Desempate pelo `updated_at` (também descendente):
 * com duas atas do mesmo dia, a que foi mexida agora é a que a pessoa
 * está usando.
 *
 * Não reordena o array recebido — a tela costuma usar a lista original
 * depois, pra contar.
 */
export function ordenarPorData(atas: AtaResumo[]): AtaResumo[] {
  return [...atas].sort(
    (a, b) =>
      b.data.localeCompare(a.data) || b.atualizadoEm.localeCompare(a.atualizadoEm)
  );
}

export interface GrupoDeAtas {
  /** YYYY-MM-DD do grupo. */
  data: string;
  /** "Hoje", "Ontem", "02/10/2026". */
  rotulo: string;
  atas: AtaResumo[];
}

/**
 * As atas agrupadas por DIA, mais recente primeiro — "precisa ter os
 * documentos por datas" é o eixo central do pedido, não um detalhe de
 * ordenação.
 *
 * A ata de hoje não substitui a da semana passada: ela vem depois dela,
 * no grupo do próprio dia.
 */
export function agruparPorData(atas: AtaResumo[], hoje: string): GrupoDeAtas[] {
  const grupos: GrupoDeAtas[] = [];
  for (const a of ordenarPorData(atas)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === a.data) {
      ultimo.atas.push(a);
      continue;
    }
    grupos.push({ data: a.data, rotulo: rotuloDoDia(a.data, hoje), atas: [a] });
  }
  return grupos;
}

/**
 * Cabeçalho do grupo de data. "Hoje" e "Ontem" por extenso porque é a
 * maior parte do uso (ata é registro de reunião recente); o resto vira
 * data completa, que é o que se procura quando se olha pra trás.
 */
export function rotuloDoDia(iso: string, hoje: string): string {
  if (!iso) return "Sem data";
  if (iso === hoje) return "Hoje";
  const d = dataValida(iso);
  const h = dataValida(hoje);
  if (d && h) {
    const dias = Math.round((h.getTime() - d.getTime()) / 86_400_000);
    if (dias === 1) return "Ontem";
  }
  return formatDataCompleta(iso);
}

/**
 * Meio-dia no fuso de Brasília, pra ler o DIA de um timestamptz.
 *
 * `referencia_em.slice(0, 10)` daria o dia em UTC: uma ata gravada às 22h
 * de Brasília apareceria no dia seguinte. As atas são gravadas ao
 * meio-dia UTC justamente pra as duas contas baterem (ver a migration),
 * mas o fallback pro `created_at` não tem essa garantia — ele é um
 * instante real, de qualquer hora.
 */
const FMT_DIA_BRASILIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * O DIA da ata (YYYY-MM-DD). Usa `referencia_em` — a data que a pessoa
 * escolheu — e cai no `created_at` quando ela não existe, pra uma ata
 * nunca ficar sem data e desaparecer do agrupamento.
 */
export function dataDaAta(
  referenciaEm: string | null,
  createdAt: string
): string {
  const bruto = referenciaEm || createdAt;
  if (!bruto) return "";
  const d = new Date(bruto);
  if (Number.isNaN(d.getTime())) return "";
  return FMT_DIA_BRASILIA.format(d);
}

/** Como um dia escolhido na tela vira `referencia_em`. Ver `dataDaAta`. */
export function diaParaReferencia(dia: string): string {
  return `${dia}T12:00:00Z`;
}

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Dia que serve pra gravar: o formato certo E uma data que existe. */
export function diaValido(dia: string): boolean {
  if (!DIA_RE.test(dia)) return false;
  // `2026-02-31` passa no regex e `new Date` o aceita virando 3 de março —
  // a ata nasceria num dia que ninguém escolheu. A ida e volta pega isso.
  const d = dataValida(dia);
  return d !== null && d.toISOString().slice(0, 10) === dia;
}

/**
 * O nome do cliente na ata, na MESMA precedência da lista de projetos
 * (ver getLaneGroups): o escrito à mão ganha de tudo, o do ClickUp vem
 * depois, o cadastro fica por último.
 *
 * Importa que seja a mesma: a ata e a lista falam do mesmo projeto, e dois
 * nomes diferentes pro mesmo cliente em duas telas é o tipo de coisa que
 * faz a pessoa achar que são dois clientes.
 */
export function nomeDoClienteDaAta(c: {
  nome_exibicao?: string | null;
  clickup_nome?: string | null;
  empresa?: string | null;
  nome?: string | null;
}): string {
  return (
    c.nome_exibicao?.trim() ||
    c.clickup_nome?.trim() ||
    c.empresa?.trim() ||
    c.nome?.trim() ||
    "Sem nome"
  );
}

/** Rótulo do status do projeto, pra tela não repetir o `find`. */
export function statusLabel(status: TaskStatus | string): string {
  return (
    TASK_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
    TASK_STATUS_OPTIONS.find((o) => o.value === DEFAULT_TASK_STATUS)!.label
  );
}

/** Observação cortada pra caber numa linha da lista, sem cortar no meio da palavra. */
export function resumoDaObservacao(texto: string | null, limite = 140): string {
  const t = (texto ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= limite) return t;
  const corte = t.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`;
}
