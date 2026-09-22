import { createSupabaseServiceRoleClient } from "./supabase/server";
import { logServerError } from "./api-helpers";
import {
  MARCADO_PELO_CLIENTE,
  MATERIAIS_PADRAO,
  resumirMateriais,
  type MaterialItem,
  type MaterialStatus,
  type ResumoMateriais,
} from "./materiais-cliente";

/**
 * Leitura e escrita da lista "o que o cliente precisa nos enviar"
 * (`client_materials`). Server-only: a tabela tem RLS ligado sem policy, então
 * só passa pelo service-role — quem autoriza é quem chama (sessão da equipe
 * no admin, token do link público no lado do cliente).
 */

interface Row {
  id: string;
  client_id: string;
  titulo: string;
  instrucao: string | null;
  ordem: number;
  status: string;
  marcado_por: string | null;
  marcado_em: string | null;
  recado_do_cliente: string | null;
  conferido_em: string | null;
  conferido_por: string | null;
}

const COLS =
  "id, client_id, titulo, instrucao, ordem, status, marcado_por, marcado_em, recado_do_cliente, conferido_em, conferido_por";

export function normalizeStatus(v: unknown): MaterialStatus {
  return v === "enviado" || v === "nao_se_aplica" ? v : "pendente";
}

function normalize(row: Row): MaterialItem {
  return {
    id: row.id,
    clientId: row.client_id,
    titulo: row.titulo,
    instrucao: row.instrucao,
    ordem: Number(row.ordem ?? 0),
    status: normalizeStatus(row.status),
    marcadoPor: row.marcado_por,
    marcadoEm: row.marcado_em,
    recadoDoCliente: row.recado_do_cliente,
    conferidoEm: row.conferido_em,
    conferidoPor: row.conferido_por,
  };
}

/** A lista de um cliente, na ordem definida pela equipe. */
export async function listarMateriais(clientId: string): Promise<MaterialItem[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("client_materials")
    .select(COLS)
    .eq("client_id", clientId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data as Row[] | null) ?? []).map(normalize);
}

/**
 * Resumo ("faltam 3 de 8") de VÁRIOS clientes numa consulta só — pro hub de
 * briefings, que mostra dezenas de linhas. Uma query por linha derrubaria a
 * tela.
 */
export async function resumosPorCliente(
  clientIds: string[]
): Promise<Map<string, ResumoMateriais>> {
  const mapa = new Map<string, ResumoMateriais>();
  const ids = Array.from(new Set(clientIds.filter(Boolean)));
  if (ids.length === 0) return mapa;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("client_materials")
    .select("client_id, status, conferido_em")
    .in("client_id", ids);

  // resumirMateriais só olha status e conferidoEm — o resto do item é
  // preenchimento pra satisfazer o tipo, não vai pra lugar nenhum.
  type LinhaResumo = { client_id: string; status: string; conferido_em: string | null };
  const porCliente = new Map<string, MaterialItem[]>();
  for (const r of (data as LinhaResumo[] | null) ?? []) {
    const lista = porCliente.get(r.client_id) ?? [];
    lista.push({
      id: "",
      clientId: r.client_id,
      titulo: "",
      instrucao: null,
      ordem: 0,
      status: normalizeStatus(r.status),
      marcadoPor: null,
      marcadoEm: null,
      recadoDoCliente: null,
      conferidoEm: r.conferido_em,
      conferidoPor: null,
    });
    porCliente.set(r.client_id, lista);
  }
  for (const [clientId, itens] of porCliente) {
    mapa.set(clientId, resumirMateriais(itens));
  }
  return mapa;
}

/**
 * Semeia a lista padrão. Idempotente de propósito: se o cliente já tem
 * QUALQUER item, não faz nada — assim um clique duplo (ou dois membros
 * clicando junto) não duplica a lista inteira.
 */
export async function semearMateriaisPadrao(
  clientId: string
): Promise<{ criados: number }> {
  const service = createSupabaseServiceRoleClient();
  const { data: existentes } = await service
    .from("client_materials")
    .select("id")
    .eq("client_id", clientId)
    .limit(1);
  if (Array.isArray(existentes) && existentes.length > 0) return { criados: 0 };

  const rows = MATERIAIS_PADRAO.map((m, i) => ({
    client_id: clientId,
    titulo: m.titulo,
    instrucao: m.instrucao,
    ordem: i,
    status: "pendente",
  }));
  const { error } = await service.from("client_materials").insert(rows);
  if (error) {
    logServerError("materiais.semear", error);
    return { criados: 0 };
  }
  return { criados: rows.length };
}

/** Acrescenta um item no fim da lista. */
export async function criarMaterial(
  clientId: string,
  titulo: string,
  instrucao: string | null
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  // Última ordem + 1 (e não count): remover um item deixa buraco na numeração,
  // e o count colocaria o novo item no meio da lista.
  const { data: ultimo } = await service
    .from("client_materials")
    .select("ordem")
    .eq("client_id", clientId)
    .order("ordem", { ascending: false })
    .limit(1);
  const ordem =
    (Array.isArray(ultimo) && ultimo.length
      ? Number((ultimo[0] as { ordem: number }).ordem ?? -1)
      : -1) + 1;

  const { error } = await service.from("client_materials").insert({
    client_id: clientId,
    titulo,
    instrucao,
    ordem,
    status: "pendente",
  });
  if (error) logServerError("materiais.criar", error);
}

/** Edita título e instrução (não mexe no estado de envio). */
export async function editarMaterial(
  clientId: string,
  itemId: string,
  titulo: string,
  instrucao: string | null
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("client_materials")
    .update({ titulo, instrucao })
    .eq("id", itemId)
    // O escopo por cliente também na escrita: o id sozinho permitiria mexer
    // num item de outro cliente.
    .eq("client_id", clientId);
  if (error) logServerError("materiais.editar", error);
}

export async function removerMaterial(
  clientId: string,
  itemId: string
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("client_materials")
    .delete()
    .eq("id", itemId)
    .eq("client_id", clientId);
  if (error) logServerError("materiais.remover", error);
}

/** Sobe/desce um item, renumerando a lista inteira (mesma lógica das perguntas). */
export async function moverMaterial(
  clientId: string,
  itemId: string,
  direcao: "up" | "down"
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("client_materials")
    .select("id, ordem")
    .eq("client_id", clientId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  const lista = (data as { id: string; ordem: number }[] | null) ?? [];
  const idx = lista.findIndex((m) => m.id === itemId);
  if (idx === -1) return;
  const destino = direcao === "up" ? idx - 1 : idx + 1;
  if (destino < 0 || destino >= lista.length) return;

  const reordenada = [...lista];
  [reordenada[idx], reordenada[destino]] = [reordenada[destino], reordenada[idx]];

  for (let i = 0; i < reordenada.length; i++) {
    if (reordenada[i].ordem === i) continue;
    const { error } = await service
      .from("client_materials")
      .update({ ordem: i })
      .eq("id", reordenada[i].id);
    if (error) logServerError("materiais.mover", error);
  }
}

/**
 * A EQUIPE muda o estado de um item. Marcar "enviado" aqui já conta como
 * conferido: quem da equipe marca é porque viu o material chegar.
 */
export async function marcarPelaEquipe(
  clientId: string,
  itemId: string,
  status: MaterialStatus,
  quem: string
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  const agora = new Date().toISOString();
  const { error } = await service
    .from("client_materials")
    .update({
      status,
      marcado_por: quem,
      marcado_em: status === "pendente" ? null : agora,
      conferido_em: status === "enviado" ? agora : null,
      conferido_por: status === "enviado" ? quem : null,
      // Voltar pra pendente ("não chegou nada") limpa o recado antigo, que
      // senão fica na tela dizendo que o cliente mandou.
      ...(status === "pendente" ? { recado_do_cliente: null } : {}),
    })
    .eq("id", itemId)
    .eq("client_id", clientId);
  if (error) logServerError("materiais.marcar-equipe", error);
}

/** A equipe confirma que o material que o cliente disse ter mandado chegou. */
export async function conferirMaterial(
  clientId: string,
  itemId: string,
  quem: string
): Promise<void> {
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("client_materials")
    .update({
      status: "enviado",
      conferido_em: new Date().toISOString(),
      conferido_por: quem,
    })
    .eq("id", itemId)
    .eq("client_id", clientId);
  if (error) logServerError("materiais.conferir", error);
}

/**
 * O CLIENTE marca pelo link público do briefing. Nunca marca como conferido —
 * "eu mandei" não é o mesmo que "chegou", e é a equipe que fecha isso.
 *
 * Devolve o título do item pra quem chamou poder avisar a equipe.
 */
export async function marcarPeloCliente(
  clientId: string,
  itemId: string,
  status: MaterialStatus,
  recado: string | null
): Promise<{ titulo: string } | null> {
  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("client_materials")
    .update({
      status,
      marcado_por: MARCADO_PELO_CLIENTE,
      marcado_em: status === "pendente" ? null : new Date().toISOString(),
      recado_do_cliente: recado,
      // O cliente desmarcando apaga a conferência: o item volta pra fila.
      conferido_em: null,
      conferido_por: null,
    })
    .eq("id", itemId)
    .eq("client_id", clientId)
    .select("titulo")
    .maybeSingle();
  if (error) {
    logServerError("materiais.marcar-cliente", error);
    return null;
  }
  return (data as { titulo: string } | null) ?? null;
}
