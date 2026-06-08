"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  mesRef,
  type CobrancaMensal,
  type PagamentoHistorico,
} from "@/lib/cobrancas-mensais";
import { sendDashboardWebhook } from "@/lib/dashboard-webhook";

function parseMoney(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Cria uma nova cobrança (mensal ou pontual).
 */
export async function addCobrancaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const tipo = String(formData.get("tipo") ?? "mensal") as "mensal" | "pontual";
  const nome = String(formData.get("nome") ?? "").trim();
  const valorRaw = String(formData.get("valor_mensal") ?? "");
  const valor = parseMoney(valorRaw);
  const dia = Number(formData.get("dia_cobranca") ?? "10");
  const dataVencimento = String(formData.get("data_vencimento") ?? "").trim();

  if (!nome || !valor) return;
  if (tipo === "mensal" && (dia < 1 || dia > 31)) return;
  if (tipo === "pontual" && !dataVencimento) return;

  const empresa = String(formData.get("empresa") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();

  const service = createSupabaseServiceRoleClient();
  await service.from("cobrancas_mensais").insert({
    tipo,
    nome,
    empresa: empresa || null,
    whatsapp: whatsapp || null,
    email: email || null,
    valor_mensal: valor,
    dia_cobranca: tipo === "mensal" ? dia : 1,
    data_vencimento: tipo === "pontual" ? dataVencimento : null,
    descricao: descricao || null,
    client_id: clientId || null,
    ativa: true,
    data_inicio: new Date().toISOString().slice(0, 10),
    historico: [],
  });

  revalidatePath("/admin/cobrancas");
}

/**
 * Atualiza dados básicos da cobrança (valor, dia, descrição, status).
 */
export async function updateCobrancaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const valorRaw = String(formData.get("valor_mensal") ?? "");
  if (valorRaw) {
    const v = parseMoney(valorRaw);
    if (v) updates.valor_mensal = v;
  }
  const dia = Number(formData.get("dia_cobranca") ?? "0");
  if (dia >= 1 && dia <= 31) updates.dia_cobranca = dia;

  const nome = String(formData.get("nome") ?? "").trim();
  if (nome) updates.nome = nome;
  const empresa = String(formData.get("empresa") ?? "").trim();
  updates.empresa = empresa || null;
  const descricao = String(formData.get("descricao") ?? "").trim();
  updates.descricao = descricao || null;

  if (formData.has("ativa")) {
    updates.ativa = formData.get("ativa") === "1";
  }

  const service = createSupabaseServiceRoleClient();
  await service.from("cobrancas_mensais").update(updates).eq("id", id);

  revalidatePath("/admin/cobrancas");
}

/**
 * Apaga a cobrança permanente (toda história junto).
 */
export async function deleteCobrancaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("cobrancas_mensais").delete().eq("id", id);

  revalidatePath("/admin/cobrancas");
}

/**
 * Registra um pagamento — adiciona entry no histórico jsonb.
 */
export async function registrarPagamentoAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  const mes = String(formData.get("mes_referencia") ?? "").trim();
  const valorRaw = String(formData.get("valor_pago") ?? "");
  const valor = parseMoney(valorRaw);
  const forma = String(formData.get("forma") ?? "pix").trim();
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!id || !mes || !valor) return;

  const service = createSupabaseServiceRoleClient();
  const { data: cur } = await service
    .from("cobrancas_mensais")
    .select("historico")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return;

  const historico = (cur.historico as PagamentoHistorico[] | null) ?? [];

  // Evita duplicar mesma referência — substitui se já existe
  const filtrado = historico.filter((h) => h.mesReferencia !== mes);
  const novo: PagamentoHistorico = {
    id: crypto.randomUUID(),
    mesReferencia: mes,
    valorPago: valor,
    pagoEm: new Date().toISOString(),
    forma,
    observacao,
  };
  const novoHistorico = [...filtrado, novo].sort((a, b) =>
    a.mesReferencia.localeCompare(b.mesReferencia)
  );

  await service
    .from("cobrancas_mensais")
    .update({
      historico: novoHistorico,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Dispara webhook pro app financeiro (financas-app)
  await sendCobrancaPagaWebhook(id, novo);

  revalidatePath("/admin/cobrancas");
}

/** Helper que carrega a cobrança e dispara webhook. */
async function sendCobrancaPagaWebhook(
  cobrancaId: string,
  pagamento: PagamentoHistorico
): Promise<void> {
  try {
    const service = createSupabaseServiceRoleClient();
    const { data: c } = await service
      .from("cobrancas_mensais")
      .select(
        "id, client_id, tipo, nome, empresa, whatsapp, email, descricao"
      )
      .eq("id", cobrancaId)
      .maybeSingle();
    if (!c) return;

    void sendDashboardWebhook({
      event: "cobranca.paga",
      emittedAt: new Date().toISOString(),
      source: "briefing_app",
      // clientId é opcional pra cobrança externa — usa o cobranca id como fallback
      clientId: c.client_id ?? cobrancaId,
      cobrancaId: cobrancaId,
      cobranca: {
        tipo: c.tipo as "mensal" | "pontual",
        nome: c.nome,
        empresa: c.empresa,
        whatsapp: c.whatsapp,
        email: c.email,
        descricao: c.descricao,
        valor: Number(pagamento.valorPago),
        mesReferencia: pagamento.mesReferencia,
        pagoEm: pagamento.pagoEm,
        forma: pagamento.forma,
        observacao: pagamento.observacao,
      },
    });
  } catch (err) {
    console.warn("[cobrancas] webhook falhou:", err);
  }
}

/**
 * Remove uma entry do histórico (correção de erro).
 */
export async function removerPagamentoAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const cobrancaId = String(formData.get("cobranca_id") ?? "");
  const pagamentoId = String(formData.get("pagamento_id") ?? "");
  if (!cobrancaId || !pagamentoId) return;

  const service = createSupabaseServiceRoleClient();
  const { data: cur } = await service
    .from("cobrancas_mensais")
    .select("historico")
    .eq("id", cobrancaId)
    .maybeSingle();
  if (!cur) return;

  const historico = (cur.historico as PagamentoHistorico[] | null) ?? [];
  const novo = historico.filter((h) => h.id !== pagamentoId);

  await service
    .from("cobrancas_mensais")
    .update({ historico: novo, updated_at: new Date().toISOString() })
    .eq("id", cobrancaId);

  revalidatePath("/admin/cobrancas");
}

/**
 * Atalho: registrar pagamento DO MÊS ATUAL com 1 click.
 * Usa o valor_mensal padrão da cobrança.
 */
export async function marcarPagoEsteMesAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  const { data: cur } = await service
    .from("cobrancas_mensais")
    .select("historico, valor_mensal")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return;

  const ref = mesRef(new Date());
  const historico = (cur.historico as PagamentoHistorico[] | null) ?? [];
  if (historico.some((h) => h.mesReferencia === ref)) {
    revalidatePath("/admin/cobrancas");
    return;
  }

  const novo: PagamentoHistorico = {
    id: crypto.randomUUID(),
    mesReferencia: ref,
    valorPago: Number(cur.valor_mensal),
    pagoEm: new Date().toISOString(),
    forma: "pix",
    observacao: "",
  };

  await service
    .from("cobrancas_mensais")
    .update({
      historico: [...historico, novo],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Webhook pro financas-app
  await sendCobrancaPagaWebhook(id, novo);

  revalidatePath("/admin/cobrancas");
}
