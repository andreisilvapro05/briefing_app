import { randomBytes } from "node:crypto";
import type { PartialBlock } from "@blocknote/core";
import { createSupabaseServiceRoleClient } from "./supabase/server";
import { fetchBriefingPages } from "./clickup-docs";
import { markdownToBlocks, blockPlainText } from "./markdown-to-blocks";
import { extrairCredenciais, type CredencialItem } from "./briefing-credenciais";
import { casarCliente, type ClienteRef } from "./briefing-match";
import type { EIDocumentSummary } from "./ei-documents";

/**
 * O briefing como ENTIDADE PRÓPRIA, não mais como aba da ficha do cliente.
 *
 * Pedido do usuário (2026-09-20): "os briefings devem poder ser acessados
 * de forma separada da pessoa (...) não pode tudo estar na ficha do cliente
 * e a Valéria designer ter acesso, precisamos ter separado o briefing ter
 * um link público compartilhado".
 *
 * Três consequências de arquitetura:
 *  1. um cliente pode ter VÁRIOS briefings (o ClickUp tem Sofia Rito de
 *     julho e de setembro) — o índice único (client_id, kind) caiu;
 *  2. um briefing pode existir SEM cliente (avulso), o que é o destino de
 *     toda página do ClickUp que não casou com confiança;
 *  3. o link público tem token PRÓPRIO, não o magic_slug — o magic_slug
 *     abre painel, moodboard e entrega de uma vez.
 */

export interface BriefingResumo {
  id: string;
  titulo: string;
  clientId: string | null;
  clienteNome: string | null;
  isTemplate: boolean;
  origem: string | null;
  compartilhado: boolean;
  temCredenciais: boolean;
  /** Quantos blocos com texto — separa briefing real de modelo em branco. */
  preenchimento: number;
  /**
   * O conteúdo é idêntico ao do Modelo, ou seja: ninguém escreveu nada nele.
   *
   * `preenchimento` sozinho não pega esse caso — o clone herda TODO o texto
   * do Modelo e aparece como "48 linhas", parecendo um briefing de verdade.
   * Em 2026-09-21 havia 23 documentos assim no hub.
   */
  igualAoModelo: boolean;
  /**
   * Material histórico (ex-cliente ou versão antiga da mesma página do
   * ClickUp). A barra lateral do hub separa "ativos" de "arquivo" — sem
   * este campo ela mostraria os dois blocos juntos, que é o que a migration
   * 20260922120000 criou a coluna pra evitar.
   */
  arquivado: boolean;
  updatedAt: string;
}

export interface BriefingCompleto extends BriefingResumo {
  blocks: PartialBlock[];
  shareToken: string | null;
  shareExpiresAt: string | null;
  credenciais: CredencialItem[];
  clickupPageId: string | null;
}

interface Row {
  id: string;
  client_id: string | null;
  nome: string | null;
  is_template: boolean;
  origem: string | null;
  ei_data: { blocks?: unknown[] } | null;
  credenciais: CredencialItem[] | null;
  share_token: string | null;
  share_enabled: boolean | null;
  share_expires_at: string | null;
  clickup_page_id: string | null;
  arquivado: boolean | null;
  updated_at: string;
  clients: { id: string; nome: string | null; empresa: string | null } | null;
}

const COLS =
  "id, client_id, nome, is_template, origem, ei_data, credenciais, share_token, share_enabled, share_expires_at, clickup_page_id, arquivado, updated_at, clients(id, nome, empresa)";

/**
 * Conta blocos que têm texto de verdade. É isso que distingue um briefing
 * preenchido de um clone intocado do modelo — os 23 briefings que existiam
 * no app tinham TODOS exatamente 28.586 bytes, ou seja, o modelo puro.
 */
function contarPreenchimento(blocks: PartialBlock[]): number {
  return blocks.filter((b) => {
    const t = blockPlainText(b).trim();
    if (!t) return false;
    // Rótulo do modelo ("Telefone:", "Login:") não conta como preenchido.
    return !/^[^:]{1,60}:$/.test(t);
  }).length;
}

function blocosDe(row: Row): PartialBlock[] {
  return Array.isArray(row.ei_data?.blocks)
    ? (row.ei_data.blocks as PartialBlock[])
    : [];
}

function tituloDe(row: Pick<Row, "is_template" | "nome" | "clients">): string {
  if (row.is_template) return "Modelo de briefing";
  if (row.nome?.trim()) return row.nome.trim();
  const c = row.clients;
  if (c) return c.empresa?.trim() || c.nome?.trim() || "Sem título";
  return "Briefing sem título";
}

/** Assinatura do conteúdo: só o texto, pra ignorar ids de bloco. */
function assinatura(blocks: PartialBlock[]): string {
  return blocks
    .map((b) => blockPlainText(b).trim())
    .filter(Boolean)
    .join("\u0001");
}

function resumo(row: Row, assinaturaModelo?: string | null): BriefingResumo {
  const blocks = blocosDe(row);
  const assin = assinatura(blocks);
  return {
    id: row.id,
    titulo: tituloDe(row),
    clientId: row.client_id,
    clienteNome: row.clients
      ? row.clients.empresa?.trim() || row.clients.nome?.trim() || null
      : null,
    isTemplate: row.is_template,
    origem: row.origem,
    compartilhado: Boolean(row.share_enabled && row.share_token),
    temCredenciais: Array.isArray(row.credenciais) && row.credenciais.length > 0,
    preenchimento: contarPreenchimento(blocks),
    igualAoModelo:
      !row.is_template && !!assinaturaModelo && assin === assinaturaModelo,
    arquivado: Boolean(row.arquivado),
    updatedAt: row.updated_at,
  };
}

/** Todos os briefings, mais recente primeiro — a lista central de /admin/briefings. */
export async function listarBriefings(): Promise<BriefingResumo[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(COLS)
    .eq("kind", "briefing")
    .order("is_template", { ascending: false })
    .order("updated_at", { ascending: false });
  const rows = (data as unknown as Row[] | null) ?? [];
  // A ordenação já traz o Modelo primeiro (is_template desc).
  const modelo = rows.find((r) => r.is_template);
  const assinaturaModelo = modelo ? assinatura(blocosDe(modelo)) : null;
  return rows.map((r) => resumo(r, assinaturaModelo));
}

/**
 * Escopo por papel aplicado à lista do hub.
 *
 * "básico" (designer) só vê briefing de cliente em que está marcado — e
 * briefing AVULSO (sem cliente) fica fora, porque não há nada pra escopar
 * nele. É mais apertado que o hub de Documentos de Briefing, que deixa o
 * sem-cliente passar, e é de propósito: o avulso vazando foi o achado da
 * auditoria de 2026-09-21.
 *
 * Mora aqui, e não dentro de cada página, porque quem repete uma regra de
 * autorização em duas telas acaba corrigindo só uma.
 */
export function briefingsVisiveis<T extends { clientId: string | null }>(
  docs: T[],
  visibleIds: Set<string> | null
): T[] {
  if (!visibleIds) return docs;
  return docs.filter((d) => d.clientId !== null && visibleIds.has(d.clientId));
}

/**
 * Modelo, ativos, arquivo — cada bloco em ordem alfabética, que é como se
 * procura um nome (mesma regra de listEIDocuments). A LISTA da tela segue por
 * data, mais recente primeiro: ali a pergunta é "o que mexeu", na barra
 * lateral é "onde está o cliente X".
 */
function ordenarBarraLateral(docs: EIDocumentSummary[]): EIDocumentSummary[] {
  return docs.sort((a, b) => {
    if (a.isTemplate !== b.isTemplate) return a.isTemplate ? -1 : 1;
    if (a.arquivado !== b.arquivado) return a.arquivado ? 1 : -1;
    const porTitulo = a.title.localeCompare(b.title, "pt-BR");
    return porTitulo !== 0 ? porTitulo : b.updatedAt.localeCompare(a.updatedAt);
  });
}

/**
 * A lista do hub no formato da barra lateral (EIDocumentSidebar), que é
 * compartilhada com os hubs de EI, Documentos e Em branco.
 *
 * Por que mapear em vez de chamar `listEIDocuments("briefing")`, como os
 * outros hubs: lá o título é sempre o nome do CLIENTE, e aqui é o `nome` da
 * página do ClickUp ("Briefing Sofia Rito — julho"), que é o que distingue os
 * vários briefings de um mesmo cliente. Misturar as duas fontes dava dois
 * nomes diferentes pro mesmo documento na mesma tela.
 */
export function briefingsParaBarraLateral(
  docs: BriefingResumo[]
): EIDocumentSummary[] {
  return ordenarBarraLateral(
    docs.map((d) => ({
      id: d.id,
      title: d.titulo,
      isTemplate: d.isTemplate,
      clientId: d.clientId,
      kind: "briefing" as const,
      updatedAt: d.updatedAt,
      arquivado: d.arquivado,
      referenciaEm: null,
    }))
  );
}

/**
 * A mesma barra lateral, para quem NÃO precisa da lista cheia — a tela de um
 * briefing só.
 *
 * Existe por causa do peso: `listarBriefings()` traz `ei_data` de todos, e
 * cada briefing clonado do Modelo tem ~28 KB de blocos (os 23 do app tinham
 * exatamente 28.586 bytes). Puxar ~1 MB a cada troca de documento pra
 * desenhar uma lista de nomes deixaria a navegação lenta justamente no clique
 * que mais se dá aqui.
 */
export async function listarBriefingsParaBarraLateral(
  visibleIds: Set<string> | null
): Promise<EIDocumentSummary[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(
      "id, client_id, nome, is_template, arquivado, updated_at, clients(id, nome, empresa)"
    )
    .eq("kind", "briefing");

  type Enxuta = Pick<Row, "is_template" | "nome" | "clients"> & {
    id: string;
    client_id: string | null;
    arquivado: boolean | null;
    updated_at: string;
  };

  const docs = ((data as unknown as Enxuta[]) ?? []).map((r) => ({
    id: r.id,
    // O MESMO título da lista: aqui o nome da página do ClickUp vence o nome
    // do cliente, e é ele que distingue os vários briefings de um cliente só.
    title: tituloDe(r),
    isTemplate: r.is_template,
    clientId: r.client_id,
    kind: "briefing" as const,
    updatedAt: r.updated_at,
    arquivado: Boolean(r.arquivado),
    referenciaEm: null,
  }));

  return ordenarBarraLateral(briefingsVisiveis(docs, visibleIds));
}

export async function obterBriefing(id: string): Promise<BriefingCompleto | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(COLS)
    .eq("id", id)
    .eq("kind", "briefing")
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row;
  return {
    ...resumo(row),
    blocks: blocosDe(row),
    shareToken: row.share_token,
    shareExpiresAt: row.share_expires_at,
    credenciais: Array.isArray(row.credenciais) ? row.credenciais : [],
    clickupPageId: row.clickup_page_id,
  };
}

/**
 * Busca pelo token público. Devolve null quando o link foi revogado ou
 * expirou — o /b/[token] responde notFound() nesses casos, sem revelar que
 * o briefing existe.
 *
 * NUNCA devolve credenciais: a página pública não tem o que fazer com elas.
 */
export async function obterBriefingPorToken(
  token: string
): Promise<Omit<BriefingCompleto, "credenciais"> | null> {
  if (!token || token.length < 16) return null;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select(COLS)
    .eq("share_token", token)
    .eq("kind", "briefing")
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row;
  if (!row.share_enabled) return null;
  if (row.share_expires_at && new Date(row.share_expires_at) < new Date())
    return null;
  return {
    ...resumo(row),
    blocks: blocosDe(row),
    shareToken: row.share_token,
    shareExpiresAt: row.share_expires_at,
    clickupPageId: row.clickup_page_id,
  };
}

/** 32 hex = 128 bits. Não adianta chutar. */
function novoToken(): string {
  return randomBytes(16).toString("hex");
}

/** Liga o link público, gerando token na primeira vez. */
export async function ativarCompartilhamento(
  id: string,
  opts?: { expiraEmDias?: number | null }
): Promise<{ token: string } | { erro: string }> {
  const service = createSupabaseServiceRoleClient();
  const { data: atual } = await service
    .from("ei_documents")
    .select("share_token")
    .eq("id", id)
    .maybeSingle();
  if (!atual) return { erro: "Briefing não encontrado." };

  const token = (atual as { share_token: string | null }).share_token ?? novoToken();
  const expira =
    opts?.expiraEmDias && opts.expiraEmDias > 0
      ? new Date(Date.now() + opts.expiraEmDias * 86400_000).toISOString()
      : null;

  const { error } = await service
    .from("ei_documents")
    .update({
      share_token: token,
      share_enabled: true,
      share_created_at: new Date().toISOString(),
      share_expires_at: expira,
    })
    .eq("id", id);
  if (error) return { erro: error.message };
  return { token };
}

/**
 * Revoga. Troca o token em vez de só desligar a flag: quem já tem o link
 * antigo não volta a entrar se o compartilhamento for religado depois.
 */
export async function revogarCompartilhamento(
  id: string
): Promise<{ erro?: string }> {
  const service = createSupabaseServiceRoleClient();
  // Devolve o erro em vez de void: quem chama redirecionava sempre, e um
  // link que continuou valendo depois de "Revogar" é um vazamento que a
  // pessoa acha que fechou.
  const { error } = await service
    .from("ei_documents")
    .update({ share_token: null, share_enabled: false, share_expires_at: null })
    .eq("id", id);
  return error ? { erro: error.message } : {};
}

export interface ResultadoImportacao {
  ok: boolean;
  reason?: string;
  criados: number;
  atualizados: number;
  semCliente: number;
  credenciaisProtegidas: number;
  ignorados: number;
  /** Já importados que a equipe editou aqui depois — corpo NÃO sobrescrito. */
  preservados: number;
  detalhes: { pagina: string; acao: string; motivo: string }[];
}

/**
 * Importa as páginas do doc de briefings do ClickUp — FIDEDIGNO: o corpo
 * vira bloco a bloco o que está lá (caixinhas marcadas, links, divisores),
 * não um modelo em branco.
 *
 * Idempotente por `clickup_page_id`: rodar de novo atualiza o que mudou no
 * ClickUp em vez de duplicar.
 */
export async function importarBriefingsDoClickUp(): Promise<ResultadoImportacao> {
  const vazio: ResultadoImportacao = {
    ok: false,
    criados: 0,
    atualizados: 0,
    semCliente: 0,
    credenciaisProtegidas: 0,
    ignorados: 0,
    preservados: 0,
    detalhes: [],
  };

  const doc = await fetchBriefingPages();
  if (!doc.ok) return { ...vazio, reason: doc.reason };

  // Se veio página mas nenhuma com conteúdo, o problema é o formato da
  // resposta do ClickUp — não "briefings vazios". Sem esta checagem a
  // importação terminaria dizendo "160 ignorados" e pareceria sucesso.
  if (doc.pages.length > 0 && doc.pages.every((p) => !(p.content ?? "").trim())) {
    return {
      ...vazio,
      reason:
        `O ClickUp devolveu ${doc.pages.length} páginas, mas todas sem conteúdo. ` +
        "Nada foi importado — o formato da resposta mudou.",
    };
  }
  if (doc.pages.length === 0) {
    return { ...vazio, reason: "O ClickUp não devolveu nenhuma página." };
  }

  const service = createSupabaseServiceRoleClient();
  const [{ data: clientesData }, { data: existentesData }] = await Promise.all([
    service.from("clients").select("id, nome, empresa"),
    service
      .from("ei_documents")
      .select("id, clickup_page_id, client_id, updated_at")
      .eq("kind", "briefing")
      .not("clickup_page_id", "is", null),
  ]);

  const clientes = (clientesData as ClienteRef[] | null) ?? [];
  const jaImportado = new Map<string, { id: string; updatedAt: string | null }>();
  for (const r of (existentesData as
    | { id: string; clickup_page_id: string; updated_at: string | null }[]
    | null) ?? []) {
    jaImportado.set(r.clickup_page_id, { id: r.id, updatedAt: r.updated_at });
  }

  const res: ResultadoImportacao = { ...vazio, ok: true, detalhes: [] };

  for (const page of doc.pages) {
    const corpo = (page.content ?? "").trim();
    // Página vazia no ClickUp não tem o que trazer.
    if (corpo.length < 40) {
      res.ignorados += 1;
      res.detalhes.push({
        pagina: page.name,
        acao: "ignorado",
        motivo: "página vazia no ClickUp",
      });
      continue;
    }

    const brutos = markdownToBlocks(corpo);
    const { blocks, credenciais } = extrairCredenciais(brutos);
    if (credenciais.length) res.credenciaisProtegidas += credenciais.length;

    const palpite = casarCliente(page.name, clientes);
    if (!palpite.clientId) res.semCliente += 1;

    const payload = {
      kind: "briefing" as const,
      nome: page.name,
      is_template: false,
      origem: "clickup",
      clickup_page_id: page.id,
      ei_data: { blocks },
      credenciais: credenciais.length ? credenciais : null,
      updated_at: page.dateUpdated ?? new Date().toISOString(),
    };

    const existente = jaImportado.get(page.id);
    if (existente) {
      /**
       * Editado AQUI depois da última alteração lá: o corpo local vence.
       *
       * Antes, reimportar sobrescrevia `ei_data` de toda página já
       * importada — e 34 dos 35 briefings vieram do ClickUp. Quem
       * corrigisse um briefing no app perdia o trabalho na próxima
       * importação, em silêncio. Como o app é o destino da migração e o
       * ClickUp a origem histórica, na dúvida quem manda é o app.
       *
       * Sem data dos dois lados não dá pra comparar: aí atualiza, que é o
       * comportamento antigo.
       */
      const nossa = existente.updatedAt ? Date.parse(existente.updatedAt) : NaN;
      const deLa = page.dateUpdated ? Date.parse(page.dateUpdated) : NaN;
      if (Number.isFinite(nossa) && Number.isFinite(deLa) && nossa > deLa) {
        res.preservados += 1;
        res.detalhes.push({
          pagina: page.name,
          acao: "preservado",
          motivo: "editado no app depois da última mudança no ClickUp",
        });
        continue;
      }

      // Não sobrescreve um vínculo que a equipe já ajustou na mão.
      const { error } = await service
        .from("ei_documents")
        .update(payload)
        .eq("id", existente.id);
      if (error) {
        res.detalhes.push({ pagina: page.name, acao: "erro", motivo: error.message });
        continue;
      }
      res.atualizados += 1;
      res.detalhes.push({
        pagina: page.name,
        acao: "atualizado",
        motivo: palpite.motivo,
      });
      continue;
    }

    const { error } = await service.from("ei_documents").insert({
      ...payload,
      client_id: palpite.clientId,
    });
    if (error) {
      res.detalhes.push({ pagina: page.name, acao: "erro", motivo: error.message });
      continue;
    }
    res.criados += 1;
    res.detalhes.push({
      pagina: page.name,
      acao: palpite.clientId ? "criado" : "criado (avulso)",
      motivo: palpite.motivo,
    });
  }

  return res;
}

/** Vincula/desvincula um briefing avulso a um cliente. */
export async function vincularBriefingACliente(
  briefingId: string,
  clientId: string | null
): Promise<{ erro?: string }> {
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({ client_id: clientId })
    .eq("id", briefingId)
    .eq("kind", "briefing");
  return error ? { erro: error.message } : {};
}

/**
 * Só o cliente por trás de um token público — sem carregar os blocos.
 *
 * Existe pro lado do cliente da lista "o que você precisa nos enviar": a ação
 * que marca um item precisa saber DE QUEM é o briefing daquele link, e nada
 * mais. Aplica as mesmas travas de `obterBriefingPorToken` (revogado ou
 * expirado devolve null), pra um link revogado não continuar escrevendo no
 * banco.
 */
export async function clienteDoBriefingPorToken(
  token: string
): Promise<{ briefingId: string; clientId: string } | null> {
  if (!token || token.length < 16) return null;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id, client_id, share_enabled, share_expires_at")
    .eq("share_token", token)
    .eq("kind", "briefing")
    .maybeSingle();
  const row = data as {
    id: string;
    client_id: string | null;
    share_enabled: boolean | null;
    share_expires_at: string | null;
  } | null;
  if (!row || !row.share_enabled || !row.client_id) return null;
  if (row.share_expires_at && new Date(row.share_expires_at) < new Date())
    return null;
  return { briefingId: row.id, clientId: row.client_id };
}
