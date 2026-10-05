import { createSupabaseServiceRoleClient } from "./supabase/server";
import { logServerError } from "./api-helpers";
import { nomeDoProjeto } from "./workflow-lanes";
import type {
  NivelAutorizacao,
  ProofAsset,
  ProofStatus,
  Prova,
  TipoDeAsset,
  UsoDaProva,
} from "./prova";

/**
 * Leitura e escrita do Banco de prova (service-role). Separado de
 * `prova.ts` pelo mesmo motivo de `project-tasks-server.ts`: aquele é puro
 * e testável, este puxa o Supabase (que puxa `next/headers`).
 */

const COLS = `
  id, client_id, status, segmento, servico, cidade, site_url,
  depoimento_texto, depoimento_audio_path, depoimento_transcricao, nota,
  autorizacao_nivel, autorizacao_termo, autorizado_por, autorizado_em,
  resultado_texto, resultado_fonte, resultado_data,
  tags, usado_em, conferido_por, conferido_em, created_at, updated_at,
  clients(id, nome, empresa, nome_exibicao, clickup_nome)
`;

interface RowProva {
  id: string;
  client_id: string;
  status: string;
  segmento: string | null;
  servico: string | null;
  cidade: string | null;
  site_url: string | null;
  depoimento_texto: string | null;
  depoimento_audio_path: string | null;
  depoimento_transcricao: string | null;
  nota: number | null;
  autorizacao_nivel: number | null;
  autorizacao_termo: string | null;
  autorizado_por: string | null;
  autorizado_em: string | null;
  resultado_texto: string | null;
  resultado_fonte: string | null;
  resultado_data: string | null;
  tags: string[] | null;
  usado_em: unknown;
  conferido_por: string | null;
  conferido_em: string | null;
  created_at: string;
  updated_at: string;
  clients: {
    id: string;
    nome: string | null;
    empresa: string | null;
    nome_exibicao: string | null;
    clickup_nome: string | null;
  } | null;
}

interface RowAsset {
  id: string;
  proof_id: string;
  tipo: string;
  dispositivo: string | null;
  capturado_em: string | null;
  storage_path: string;
  legenda: string | null;
  origem: string;
  ordem: number;
}

function lerUsos(bruto: unknown): UsoDaProva[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((u) => {
    if (!u || typeof u !== "object") return [];
    const o = u as Record<string, unknown>;
    const tipo = String(o.tipo ?? "");
    if (!["post", "proposta", "pagina", "anuncio"].includes(tipo)) return [];
    return [
      {
        tipo: tipo as UsoDaProva["tipo"],
        link: typeof o.link === "string" && o.link ? o.link : null,
        data: String(o.data ?? ""),
      },
    ];
  });
}

function asset(r: RowAsset): ProofAsset {
  return {
    id: r.id,
    tipo: r.tipo as TipoDeAsset,
    dispositivo: (r.dispositivo as ProofAsset["dispositivo"]) ?? null,
    capturadoEm: r.capturado_em,
    storagePath: r.storage_path,
    legenda: r.legenda,
    origem: r.origem === "automatico" ? "automatico" : "upload",
    ordem: r.ordem,
  };
}

function normalizar(r: RowProva, assets: ProofAsset[]): Prova {
  return {
    id: r.id,
    clientId: r.client_id,
    cliente: r.clients ? nomeDoProjeto(r.clients) : "Sem nome",
    status: r.status as ProofStatus,
    segmento: r.segmento,
    servico: r.servico,
    cidade: r.cidade,
    siteUrl: r.site_url,
    depoimentoTexto: r.depoimento_texto,
    depoimentoAudioPath: r.depoimento_audio_path,
    depoimentoTranscricao: r.depoimento_transcricao,
    nota: r.nota,
    autorizacaoNivel: (r.autorizacao_nivel as NivelAutorizacao | null) ?? null,
    autorizacaoTermo: r.autorizacao_termo,
    autorizadoPor: r.autorizado_por,
    autorizadoEm: r.autorizado_em,
    resultadoTexto: r.resultado_texto,
    resultadoFonte: r.resultado_fonte,
    resultadoData: r.resultado_data,
    tags: r.tags ?? [],
    usadoEm: lerUsos(r.usado_em),
    conferidoPor: r.conferido_por,
    conferidoEm: r.conferido_em,
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at,
    assets,
  };
}

/**
 * Os assets de várias provas numa consulta só — N+1 aqui seria uma ida ao
 * banco por projeto entregue da história da agência.
 */
async function assetsDe(proofIds: string[]): Promise<Map<string, ProofAsset[]>> {
  const mapa = new Map<string, ProofAsset[]>();
  if (proofIds.length === 0) return mapa;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("proof_assets")
    .select("*")
    .in("proof_id", proofIds)
    .order("ordem", { ascending: true });

  for (const r of (data as RowAsset[] | null) ?? []) {
    const a = asset(r);
    const atual = mapa.get(r.proof_id);
    if (atual) atual.push(a);
    else mapa.set(r.proof_id, [a]);
  }
  return mapa;
}

/**
 * Todas as provas visíveis, mais recente primeiro.
 *
 * @param visibleIds escopo por cliente. `null` = acesso total; Set vazio =
 * não vê nenhuma (não é "vê todas").
 */
export async function listarProvas(
  visibleIds?: Set<string> | null
): Promise<Prova[]> {
  if (visibleIds && visibleIds.size === 0) return [];

  const service = createSupabaseServiceRoleClient();
  let q = service
    .from("proof_items")
    .select(COLS)
    .order("created_at", { ascending: false });
  if (visibleIds) q = q.in("client_id", Array.from(visibleIds));

  const { data, error } = await q;
  if (error) {
    logServerError("prova.listar", error);
    return [];
  }
  const rows = (data as unknown as RowProva[] | null) ?? [];
  const assets = await assetsDe(rows.map((r) => r.id));
  return rows.map((r) => normalizar(r, assets.get(r.id) ?? []));
}

/** Uma prova, com os assets. */
export async function getProva(proofId: string): Promise<Prova | null> {
  const service = createSupabaseServiceRoleClient();
  // Por chave primária: `.maybeSingle()` não corre risco de várias linhas.
  const { data } = await service
    .from("proof_items")
    .select(COLS)
    .eq("id", proofId)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as RowProva;
  const assets = await assetsDe([proofId]);
  return normalizar(row, assets.get(proofId) ?? []);
}

/** A prova de um cliente — o painel dele mostra o formulário de depoimento. */
export async function provaDoCliente(clientId: string): Promise<Prova | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("proof_items")
    .select(COLS)
    .eq("client_id", clientId)
    // ⚠️ Sem `.maybeSingle()`: um cliente pode ter mais de uma prova (dois
    // projetos), e `.maybeSingle()` ESTOURA com várias linhas — armadilha
    // que já quebrou briefings e templates neste app duas vezes.
    .order("created_at", { ascending: false })
    .limit(1);

  const rows = (data as unknown as RowProva[] | null) ?? [];
  const row = rows[0];
  if (!row) return null;
  const assets = await assetsDe([row.id]);
  return normalizar(row, assets.get(row.id) ?? []);
}

/** O cliente dono de uma prova, do banco — pra autorizar toda escrita. */
export async function clienteDaProva(proofId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("proof_items")
    .select("client_id")
    .eq("id", proofId)
    .maybeSingle();
  return (data as { client_id: string } | null)?.client_id ?? null;
}

/**
 * Abre a prova de um cliente, se ele ainda não tiver uma aberta.
 *
 * Idempotente de propósito: é chamada tanto pelo botão da equipe quanto
 * (no futuro) pelo gatilho da entrega finalizada, e duas provas do mesmo
 * projeto seriam duas listas de depoimento pro mesmo cliente.
 */
export async function abrirProva(
  clientId: string,
  dados: { segmento?: string; servico?: string; siteUrl?: string } = {}
): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data: existentes } = await service
    .from("proof_items")
    .select("id")
    .eq("client_id", clientId)
    .not("status", "in", "(arquivado)")
    .order("created_at", { ascending: false })
    .limit(1);
  const ja = (existentes as { id: string }[] | null)?.[0];
  if (ja) return ja.id;

  const { data, error } = await service
    .from("proof_items")
    .insert({
      client_id: clientId,
      status: "a_coletar",
      segmento: dados.segmento || null,
      servico: dados.servico || null,
      site_url: dados.siteUrl || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    logServerError("prova.abrir", error);
    return null;
  }
  return (data as { id: string }).id;
}

/** Clientes que ainda não têm prova aberta — o seletor da tela. */
export async function clientesSemProva(
  visibleIds?: Set<string> | null
): Promise<{ id: string; label: string }[]> {
  if (visibleIds && visibleIds.size === 0) return [];

  const service = createSupabaseServiceRoleClient();
  const { data: provas } = await service.from("proof_items").select("client_id");
  const comProva = new Set(
    ((provas as { client_id: string }[] | null) ?? []).map((p) => p.client_id)
  );

  let q = service
    .from("clients")
    .select("id, nome, empresa, nome_exibicao, clickup_nome")
    .is("arquivado_em", null);
  if (visibleIds) q = q.in("id", Array.from(visibleIds));

  interface LinhaCliente {
    id: string;
    nome: string | null;
    empresa: string | null;
    nome_exibicao: string | null;
    clickup_nome: string | null;
  }
  const { data } = await q;
  return ((data as LinhaCliente[] | null) ?? [])
    .filter((c) => !comProva.has(c.id))
    .map((c) => ({ id: c.id, label: nomeDoProjeto(c) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
