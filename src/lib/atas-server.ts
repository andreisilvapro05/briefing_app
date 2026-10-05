import type { PartialBlock } from "@blocknote/core";
import { createSupabaseServiceRoleClient } from "./supabase/server";
import { DEFAULT_TASK_STATUS, type TaskStatus } from "./project-tasks";
import {
  dataDaAta,
  nomeDoClienteDaAta,
  type AtaResumo,
  type LinhaDaAta,
} from "./atas";

/**
 * Leitura das atas de acompanhamento (service-role). Separado de `atas.ts`
 * pelo mesmo motivo de `project-tasks-server.ts`: aquele arquivo é puro e
 * testável, este puxa o Supabase (que puxa `next/headers`).
 *
 * UMA ATA = UMA REUNIÃO, com vários clientes dentro (Karine, 05/10: "não é
 * pra ser individual de cada cliente, e sim tudo num documento só"). O
 * documento é `ei_documents` com `kind='ata'` e `client_id` NULO; cada
 * cliente dentro dela é uma linha em `ata_linhas`. Ver a migration
 * 20261005120000.
 *
 * O STATUS nunca é copiado: vem de `clients.status` em toda leitura. É o
 * que faz "mudou pra finalizado, some dali" funcionar sem escrita nenhuma.
 */

const CLIENTE_COLS =
  "id, nome, empresa, nome_exibicao, clickup_nome, status, arquivado_em";

interface ClienteDaAta {
  id: string;
  nome: string | null;
  empresa: string | null;
  nome_exibicao: string | null;
  clickup_nome: string | null;
  status: string | null;
  arquivado_em: string | null;
}

interface RowAta {
  id: string;
  nome: string | null;
  arquivado: boolean | null;
  referencia_em: string | null;
  created_at: string;
  updated_at: string;
  ei_data?: { blocks?: unknown[] } | null;
}

interface RowLinha {
  id: string;
  ata_id: string;
  client_id: string;
  observacao: string | null;
  ordem: number;
  clients: ClienteDaAta | null;
}

function linhaDe(row: RowLinha): LinhaDaAta | null {
  const c = row.clients;
  // Sem cliente não há linha: o FK é NOT NULL, então isto só acontece se o
  // join falhar — e uma linha sem nome na ata seria um registro mudo.
  if (!c) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    cliente: nomeDoClienteDaAta(c),
    statusProjeto: (c.status || DEFAULT_TASK_STATUS) as TaskStatus,
    observacao: row.observacao,
    ordem: row.ordem,
    projetoArquivado: Boolean(c.arquivado_em),
  };
}

function ataDe(row: RowAta, linhas: LinhaDaAta[]): AtaResumo {
  return {
    id: row.id,
    titulo: row.nome?.trim() || "Ata sem título",
    data: dataDaAta(row.referencia_em, row.created_at),
    atualizadoEm: row.updated_at,
    arquivada: Boolean(row.arquivado),
    linhas,
  };
}

/**
 * Busca as linhas de várias atas de uma vez.
 *
 * Uma consulta só, e não uma por ata: a lista mostra todas as atas com a
 * contagem de clientes de cada, e N+1 aqui seria uma ida ao banco por
 * reunião da história da agência.
 */
async function linhasDasAtas(
  ataIds: string[],
  visibleIds?: Set<string> | null
): Promise<Map<string, LinhaDaAta[]>> {
  const mapa = new Map<string, LinhaDaAta[]>();
  if (ataIds.length === 0) return mapa;

  const service = createSupabaseServiceRoleClient();
  let q = service
    .from("ata_linhas")
    .select(`id, ata_id, client_id, observacao, ordem, clients(${CLIENTE_COLS})`)
    .in("ata_id", ataIds)
    .order("ordem", { ascending: true });
  /**
   * O escopo por cliente recorta as LINHAS, não a ata.
   *
   * A ata é da agência inteira; quem só vê três clientes deve ver a mesma
   * reunião com três linhas, não deixar de ver a reunião. Esconder a ata
   * inteira faria o "básico" achar que não houve reunião.
   */
  if (visibleIds) q = q.in("client_id", Array.from(visibleIds));

  const { data } = await q;
  for (const row of (data as unknown as RowLinha[] | null) ?? []) {
    const l = linhaDe(row);
    if (!l) continue;
    const atual = mapa.get(row.ata_id);
    if (atual) atual.push(l);
    else mapa.set(row.ata_id, [l]);
  }
  return mapa;
}

/** Todas as atas, mais recente primeiro, já com os clientes de cada uma. */
export async function listarAtas(
  visibleIds?: Set<string> | null
): Promise<AtaResumo[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id, nome, arquivado, referencia_em, created_at, updated_at")
    .eq("kind", "ata")
    // A ordenação final é do `ordenarPorData` (que usa o DIA em Brasília,
    // não o timestamp cru). Esta aqui só evita que o banco devolva em
    // ordem arbitrária, o que faria a lista dançar entre dois carregamentos.
    .order("referencia_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (data as unknown as RowAta[] | null) ?? [];
  const linhas = await linhasDasAtas(
    rows.map((r) => r.id),
    visibleIds
  );
  return rows.map((r) => ataDe(r, linhas.get(r.id) ?? []));
}

export interface AtaCompleta extends AtaResumo {
  blocks: PartialBlock[];
}

/** Uma ata, com os clientes e os blocos do documento. */
export async function getAta(
  ataId: string,
  visibleIds?: Set<string> | null
): Promise<AtaCompleta | null> {
  const service = createSupabaseServiceRoleClient();
  // Por id (chave primária), então `.maybeSingle()` não corre o risco de
  // estourar com várias linhas — o `kind` no where é o que impede abrir
  // uma EI ou um briefing por esta tela, já que os cinco tipos dividem a
  // mesma tabela.
  const { data } = await service
    .from("ei_documents")
    .select("id, nome, arquivado, referencia_em, created_at, updated_at, ei_data")
    .eq("id", ataId)
    .eq("kind", "ata")
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as RowAta;
  const linhas = await linhasDasAtas([ataId], visibleIds);
  return {
    ...ataDe(row, linhas.get(ataId) ?? []),
    blocks: Array.isArray(row.ei_data?.blocks)
      ? (row.ei_data.blocks as PartialBlock[])
      : [],
  };
}

/**
 * A ata mais recente em que cada cliente aparece — pro espaço do membro
 * levar direto pra ela em vez de só oferecer "criar".
 *
 * Só as ATIVAS: mandar a pessoa pra uma ata arquivada seria abrir o
 * arquivo achando que é o registro corrente.
 */
export async function ultimaAtaPorCliente(
  visibleIds?: Set<string> | null
): Promise<Map<string, { id: string; data: string }>> {
  const mapa = new Map<string, { id: string; data: string }>();
  if (visibleIds && visibleIds.size === 0) return mapa;

  const service = createSupabaseServiceRoleClient();
  const { data: atasRows } = await service
    .from("ei_documents")
    .select("id, referencia_em, created_at")
    .eq("kind", "ata")
    .eq("arquivado", false)
    .order("referencia_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const atas = (atasRows as RowAta[] | null) ?? [];
  if (atas.length === 0) return mapa;

  let q = service
    .from("ata_linhas")
    .select("ata_id, client_id")
    .in(
      "ata_id",
      atas.map((a) => a.id)
    );
  if (visibleIds) q = q.in("client_id", Array.from(visibleIds));
  const { data: linhasRows } = await q;

  const porAta = new Map<string, string[]>();
  for (const l of (linhasRows as { ata_id: string; client_id: string }[] | null) ??
    []) {
    const atual = porAta.get(l.ata_id);
    if (atual) atual.push(l.client_id);
    else porAta.set(l.ata_id, [l.client_id]);
  }

  // Primeiro-ganha: `atas` já veio da mais recente pra mais antiga.
  for (const a of atas) {
    for (const clientId of porAta.get(a.id) ?? []) {
      if (mapa.has(clientId)) continue;
      mapa.set(clientId, {
        id: a.id,
        data: dataDaAta(a.referencia_em, a.created_at),
      });
    }
  }
  return mapa;
}

/** Em quantas atas ativas cada cliente aparece — o "3 atas" da linha. */
export async function contarAtasPorCliente(
  visibleIds?: Set<string> | null
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (visibleIds && visibleIds.size === 0) return mapa;

  const service = createSupabaseServiceRoleClient();
  const { data: atasRows } = await service
    .from("ei_documents")
    .select("id")
    .eq("kind", "ata")
    .eq("arquivado", false);
  const ids = ((atasRows as { id: string }[] | null) ?? []).map((a) => a.id);
  if (ids.length === 0) return mapa;

  let q = service.from("ata_linhas").select("client_id").in("ata_id", ids);
  if (visibleIds) q = q.in("client_id", Array.from(visibleIds));
  const { data } = await q;
  for (const row of (data as { client_id: string }[] | null) ?? []) {
    mapa.set(row.client_id, (mapa.get(row.client_id) ?? 0) + 1);
  }
  return mapa;
}

/**
 * Clientes que podem ser puxados pra dentro de uma ata: os projetos VIVOS.
 *
 * Projeto arquivado (desistência) fica de fora — pôr numa ata de
 * acompanhamento um projeto que não vai acontecer é criar uma linha que
 * nasce encerrada. Projeto finalizado CONTINUA na lista: reunião de
 * fechamento e pós-entrega existem; a linha dele entra já no bloco das
 * encerradas, onde é fácil de achar.
 */
export async function clientesParaAta(
  visibleIds?: Set<string> | null
): Promise<{ id: string; label: string; status: TaskStatus }[]> {
  if (visibleIds && visibleIds.size === 0) return [];

  const service = createSupabaseServiceRoleClient();
  let q = service
    .from("clients")
    .select("id, nome, empresa, nome_exibicao, clickup_nome, status")
    .is("arquivado_em", null);
  if (visibleIds) q = q.in("id", Array.from(visibleIds));

  const { data } = await q;
  return ((data as Omit<ClienteDaAta, "arquivado_em">[] | null) ?? [])
    .map((c) => ({
      id: c.id,
      label: nomeDoClienteDaAta(c),
      status: (c.status || DEFAULT_TASK_STATUS) as TaskStatus,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * Os clientes que JÁ estão numa ata, do banco.
 *
 * Toda escrita de linha passa por aqui: o `clientId` que vier num FormData
 * é do navegador, e autorizar com ele seria deixar quem monta um POST
 * escolher o cliente em que tem acesso pra mexer na linha de outro.
 */
export async function clientesDaAta(ataId: string): Promise<Set<string>> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ata_linhas")
    .select("client_id")
    .eq("ata_id", ataId);
  return new Set(
    ((data as { client_id: string }[] | null) ?? []).map((r) => r.client_id)
  );
}

/** O cliente de UMA linha, do banco — pra autorizar a edição dela. */
export async function clienteDaLinha(linhaId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ata_linhas")
    .select("client_id")
    .eq("id", linhaId)
    .maybeSingle();
  return (data as { client_id: string } | null)?.client_id ?? null;
}

/** A ata existe mesmo? (E é uma ata, não uma EI aberta por esta tela.) */
export async function ataExiste(ataId: string): Promise<boolean> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id")
    .eq("id", ataId)
    .eq("kind", "ata")
    .maybeSingle();
  return Boolean(data);
}
