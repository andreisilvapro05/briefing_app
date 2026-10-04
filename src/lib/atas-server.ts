import type { PartialBlock } from "@blocknote/core";
import { createSupabaseServiceRoleClient } from "./supabase/server";
import { DEFAULT_TASK_STATUS, type TaskStatus } from "./project-tasks";
import { dataDaAta, nomeDoClienteDaAta, type AtaResumo } from "./atas";

/**
 * Leitura das atas de acompanhamento (service-role). Separado de `atas.ts`
 * pelo mesmo motivo de `project-tasks-server.ts`: aquele arquivo é puro e
 * testável, este puxa o Supabase (que puxa `next/headers`).
 *
 * As atas são `ei_documents` com `kind = 'ata'` — ver a migration
 * 20261004120000 pro porquê. O que este arquivo faz de diferente dos
 * helpers de `ei-documents-server.ts` é trazer o CLIENTE com `status` e
 * `arquivado_em`, que é de onde sai o "some dali quando finaliza".
 */

const CLIENTE_COLS =
  "id, nome, empresa, nome_exibicao, clickup_nome, status, arquivado_em";

const SELECT_LISTA = `id, client_id, observacao, arquivado, referencia_em, created_at, updated_at, clients(${CLIENTE_COLS})`;

interface ClienteDaAta {
  id: string;
  nome: string | null;
  empresa: string | null;
  nome_exibicao: string | null;
  clickup_nome: string | null;
  status: string | null;
  arquivado_em: string | null;
}

interface LinhaDeAta {
  id: string;
  client_id: string | null;
  observacao: string | null;
  arquivado: boolean | null;
  referencia_em: string | null;
  created_at: string;
  updated_at: string;
  clients: ClienteDaAta | null;
  ei_data?: { blocks?: unknown[] } | null;
}

/**
 * Linha do banco → `AtaResumo`. Devolve `null` pra ata sem cliente: a ata
 * é "o acompanhamento DESTE cliente" (o pedido começa em "nome cliente"),
 * e uma órfã na tela seria uma linha sem título que ninguém sabe abrir.
 * `client_id` é nullable na tabela porque a Nota avulsa usa a mesma coluna.
 */
function normalizar(row: LinhaDeAta): AtaResumo | null {
  const c = row.clients;
  if (!c || !row.client_id) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    cliente: nomeDoClienteDaAta(c),
    statusProjeto: (c.status || DEFAULT_TASK_STATUS) as TaskStatus,
    observacao: row.observacao,
    data: dataDaAta(row.referencia_em, row.created_at),
    atualizadoEm: row.updated_at,
    arquivada: Boolean(row.arquivado),
    projetoArquivado: Boolean(c.arquivado_em),
  };
}

/**
 * Todas as atas que este membro pode ver.
 *
 * @param visibleIds escopo por cliente (getVisibleClientIds). `null` =
 * acesso total; Set vazio = não vê nenhuma (não é "vê todas").
 */
export async function listarAtas(
  visibleIds?: Set<string> | null
): Promise<AtaResumo[]> {
  if (visibleIds && visibleIds.size === 0) return [];

  const service = createSupabaseServiceRoleClient();
  let q = service
    .from("ei_documents")
    .select(SELECT_LISTA)
    .eq("kind", "ata")
    // A ordenação final é do `ordenarPorData` (que usa o DIA em Brasília,
    // não o timestamp cru). Esta aqui só evita que o banco devolva em
    // ordem arbitrária, o que faria a lista dançar entre dois carregamentos.
    .order("referencia_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (visibleIds) q = q.in("client_id", Array.from(visibleIds));

  const { data } = await q;
  return ((data as unknown as LinhaDeAta[]) ?? [])
    .map(normalizar)
    .filter((a): a is AtaResumo => a !== null);
}

export interface AtaCompleta extends AtaResumo {
  blocks: PartialBlock[];
}

/** Uma ata, com os blocos do documento. `null` se não existe ou não é ata. */
export async function getAta(ataId: string): Promise<AtaCompleta | null> {
  const service = createSupabaseServiceRoleClient();
  // Por id (chave primária), então `.maybeSingle()` não corre o risco de
  // estourar com várias linhas — o `kind` no where é o que impede abrir
  // uma EI ou um briefing por esta tela, já que os cinco tipos dividem a
  // mesma tabela.
  const { data } = await service
    .from("ei_documents")
    .select(`${SELECT_LISTA}, ei_data`)
    .eq("id", ataId)
    .eq("kind", "ata")
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as LinhaDeAta;
  const resumo = normalizar(row);
  if (!resumo) return null;
  return {
    ...resumo,
    blocks: Array.isArray(row.ei_data?.blocks)
      ? (row.ei_data.blocks as PartialBlock[])
      : [],
  };
}

/**
 * A ata mais recente de cada cliente — pro espaço do membro poder levar
 * direto pra ela em vez de só oferecer "criar".
 *
 * Só as ATIVAS: mandar a pessoa pra uma ata arquivada seria abrir o
 * arquivo achando que é o registro corrente.
 *
 * Em JS, e não com `.maybeSingle()` por cliente: com várias atas por
 * cliente (que é o pedido) o `.maybeSingle()` ESTOURA, e seria uma
 * consulta por projeto na tela. Uma consulta ordenada + primeiro-ganha
 * resolve as duas coisas.
 */
export async function ultimaAtaPorCliente(
  visibleIds?: Set<string> | null
): Promise<Map<string, { id: string; data: string }>> {
  const mapa = new Map<string, { id: string; data: string }>();
  if (visibleIds && visibleIds.size === 0) return mapa;

  const service = createSupabaseServiceRoleClient();
  let q = service
    .from("ei_documents")
    .select("id, client_id, referencia_em, created_at")
    .eq("kind", "ata")
    .eq("arquivado", false)
    .not("client_id", "is", null)
    .order("referencia_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (visibleIds) q = q.in("client_id", Array.from(visibleIds));

  const { data } = await q;
  for (const row of (data as
    | {
        id: string;
        client_id: string;
        referencia_em: string | null;
        created_at: string;
      }[]
    | null) ?? []) {
    // Primeiro-ganha: a consulta já veio da mais recente pra mais antiga.
    if (mapa.has(row.client_id)) continue;
    mapa.set(row.client_id, {
      id: row.id,
      data: dataDaAta(row.referencia_em, row.created_at),
    });
  }
  return mapa;
}

/** Quantas atas cada cliente tem (ativas) — o "3 atas" da linha do projeto. */
export async function contarAtasPorCliente(
  visibleIds?: Set<string> | null
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (visibleIds && visibleIds.size === 0) return mapa;

  const service = createSupabaseServiceRoleClient();
  let q = service
    .from("ei_documents")
    .select("client_id")
    .eq("kind", "ata")
    .eq("arquivado", false)
    .not("client_id", "is", null);
  if (visibleIds) q = q.in("client_id", Array.from(visibleIds));

  const { data } = await q;
  for (const row of (data as { client_id: string }[] | null) ?? []) {
    mapa.set(row.client_id, (mapa.get(row.client_id) ?? 0) + 1);
  }
  return mapa;
}

/**
 * Clientes que podem receber uma ata nova: os projetos VIVOS.
 *
 * Projeto arquivado (desistência) fica de fora — abrir ata de
 * acompanhamento num projeto que não vai acontecer é criar uma linha que
 * nasce no arquivo. Projeto finalizado CONTINUA na lista: reunião de
 * fechamento e pós-entrega existem, e a ata dela vai pro arquivo na hora,
 * onde é fácil de achar.
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
 * O `client_id` real de uma ata, direto do banco.
 *
 * Toda escrita passa por aqui: o `clientId` que vier num FormData é do
 * navegador, e autorizar com ele seria deixar quem monta um POST escolher
 * o cliente em que tem acesso pra editar a ata de outro.
 */
export async function clienteDaAta(ataId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("client_id")
    .eq("id", ataId)
    .eq("kind", "ata")
    .maybeSingle();
  return (data as { client_id: string | null } | null)?.client_id ?? null;
}
