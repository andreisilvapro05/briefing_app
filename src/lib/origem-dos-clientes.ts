/**
 * De onde veio cada cliente que fechou, e quando.
 *
 * Karine (08/10): "preciso de um relatório de onde veio cada cliente que
 * fechou, com data", "uma aba sobre isso" em Relatórios, "e poder baixar
 * para enviar para os dados de anúncios".
 *
 * ⚠️ NÃO EXISTE data de assinatura no banco. As colunas de contrato são
 * `contrato_status`, `contrato_signed_url` e `contrato_preenchido_at` — só
 * a última é uma data. Então "fechou em" é **a data em que o cliente
 * preencheu os dados do contrato**, que é o momento em que ele decidiu.
 * A assinatura em si pode vir dias depois e não deixa carimbo.
 *
 * Isso está dito na tela, e não escondido num campo chamado "data de
 * fechamento": um relatório que vai alimentar investimento em anúncio não
 * pode ter data de origem ambígua.
 */

export interface ClienteParaOrigem {
  id: string;
  nome: string | null;
  empresa: string | null;
  nome_exibicao?: string | null;
  clickup_nome?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  como_conheceu: string | null;
  contrato_preenchido_at: string | null;
  contrato_status: string | null;
  pagamento_total: number | string | null;
  created_at: string;
}

export interface LinhaDeOrigem {
  id: string;
  cliente: string;
  email: string | null;
  whatsapp: string | null;
  origem: string;
  /** Quando entrou no sistema (virou lead). YYYY-MM-DD. */
  entrouEm: string;
  /** Quando preencheu o contrato — o mais perto de "fechou". `null` = não fechou. */
  fechouEm: string | null;
  /** Dias entre entrar e fechar. `null` quando ainda não fechou. */
  diasAteFechar: number | null;
  contratoAssinado: boolean;
  valor: number;
}

export const SEM_ORIGEM = "Não informado";

function nomeDe(c: ClienteParaOrigem): string {
  return (
    c.nome_exibicao?.trim() ||
    c.clickup_nome?.trim() ||
    c.empresa?.trim() ||
    c.nome?.trim() ||
    "Sem nome"
  );
}

/** YYYY-MM-DD no fuso de Brasília — o dia que a pessoa viveu, não o do UTC. */
const DIA_BR = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function diaBrasilia(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return DIA_BR.format(d);
}

/** Dias inteiros entre dois dias YYYY-MM-DD. */
export function diasEntre(de: string, ate: string): number | null {
  const a = Date.parse(`${de}T12:00:00Z`);
  const b = Date.parse(`${ate}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export function montarLinhas(clientes: ClienteParaOrigem[]): LinhaDeOrigem[] {
  return clientes
    .map((c) => {
      const entrouEm = diaBrasilia(c.created_at) ?? "";
      const fechouEm = diaBrasilia(c.contrato_preenchido_at);
      return {
        id: c.id,
        cliente: nomeDe(c),
        email: c.email?.trim() || null,
        whatsapp: c.whatsapp?.trim() || null,
        origem: c.como_conheceu?.trim() || SEM_ORIGEM,
        entrouEm,
        fechouEm,
        diasAteFechar:
          entrouEm && fechouEm ? diasEntre(entrouEm, fechouEm) : null,
        contratoAssinado: c.contrato_status === "assinado",
        valor: Number(c.pagamento_total) || 0,
      };
    })
    // Mais recente primeiro: quem não fechou vai pro fim, ordenado pela
    // entrada — ele ainda é um lead, não um buraco na lista.
    .sort((a, b) => {
      if (a.fechouEm && b.fechouEm) return b.fechouEm.localeCompare(a.fechouEm);
      if (a.fechouEm) return -1;
      if (b.fechouEm) return 1;
      return b.entrouEm.localeCompare(a.entrouEm);
    });
}

export interface ResumoDeOrigem {
  origem: string;
  /** Quantos vieram dali, fechando ou não. */
  leads: number;
  /** Quantos fecharam (preencheram o contrato). */
  fechados: number;
  /** Soma do valor dos que fecharam. */
  valor: number;
  /** fechados / leads, de 0 a 1. */
  conversao: number;
  /** Mediana de dias até fechar. `null` se ninguém fechou. */
  medianaDias: number | null;
}

/**
 * O resumo por canal — a tabela que vai pra decisão de anúncio.
 *
 * MEDIANA, não média: um cliente que demorou oito meses pra assinar puxa a
 * média pra um número que não descreve ninguém. A mediana diz o caso
 * típico, que é o que serve pra planejar.
 */
export function resumirPorOrigem(linhas: LinhaDeOrigem[]): ResumoDeOrigem[] {
  const mapa = new Map<string, LinhaDeOrigem[]>();
  for (const l of linhas) {
    const atual = mapa.get(l.origem);
    if (atual) atual.push(l);
    else mapa.set(l.origem, [l]);
  }

  return [...mapa.entries()]
    .map(([origem, grupo]) => {
      const fechados = grupo.filter((l) => l.fechouEm !== null);
      const dias = fechados
        .map((l) => l.diasAteFechar)
        .filter((d): d is number => d !== null)
        .sort((a, b) => a - b);
      return {
        origem,
        leads: grupo.length,
        fechados: fechados.length,
        valor: fechados.reduce((s, l) => s + l.valor, 0),
        conversao: grupo.length > 0 ? fechados.length / grupo.length : 0,
        medianaDias: dias.length > 0 ? mediana(dias) : null,
      };
    })
    .sort((a, b) => b.fechados - a.fechados || b.leads - a.leads);
}

function mediana(ordenados: number[]): number {
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1
    ? ordenados[meio]
    : Math.round((ordenados[meio - 1] + ordenados[meio]) / 2);
}

/* ── O arquivo que ela baixa ──────────────────────────────────────────── */

/**
 * Uma célula de CSV.
 *
 * ⚠️ Aspas duplas viram duas, e qualquer campo com vírgula, aspas ou quebra
 * de linha vai entre aspas. Sem isso, um cliente chamado "Souza, Maria"
 * quebra a linha em duas colunas e desalinha a planilha inteira — o mesmo
 * tipo de erro que já quebrou a busca de clientes.
 */
export function celulaCSV(valor: string | number | null): string {
  const t = valor === null ? "" : String(valor);
  if (/[",\n;]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export const COLUNAS_CSV = [
  "Cliente",
  "Origem",
  "Entrou em",
  "Fechou em",
  "Dias até fechar",
  "Contrato assinado",
  "Valor",
  "E-mail",
  "WhatsApp",
] as const;

/**
 * O CSV do relatório.
 *
 * Com **ponto e vírgula** e BOM: é o que faz o Excel em português abrir o
 * arquivo em colunas e mostrar acento certo. Com vírgula e sem BOM, ele
 * joga tudo numa coluna só e troca "ç" por caractere estranho — e aí o
 * arquivo "não funciona" sem ninguém saber por quê.
 *
 * E-mail e WhatsApp vão junto porque o uso declarado é "enviar para os
 * dados de anúncios", e plataforma de anúncio casa conversão por esses
 * dois campos. É dado pessoal de cliente: o arquivo não deve circular
 * além disso.
 */
export function montarCSV(linhas: LinhaDeOrigem[]): string {
  const cabecalho = COLUNAS_CSV.join(";");
  const corpo = linhas.map((l) =>
    [
      celulaCSV(l.cliente),
      celulaCSV(l.origem),
      celulaCSV(l.entrouEm),
      celulaCSV(l.fechouEm),
      celulaCSV(l.diasAteFechar),
      celulaCSV(l.fechouEm ? (l.contratoAssinado ? "sim" : "não") : ""),
      // Vírgula decimal: é assim que o Excel em português lê número.
      celulaCSV(l.valor > 0 ? l.valor.toFixed(2).replace(".", ",") : ""),
      celulaCSV(l.email),
      celulaCSV(l.whatsapp),
    ].join(";")
  );
  return `﻿${[cabecalho, ...corpo].join("\r\n")}`;
}
