"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember, isAdmin } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
import { parseValorBR } from "@/lib/payment-receipts";
import { CATEGORIAS_CUSTO, competenciaAtual } from "@/lib/company-costs";

/**
 * Custos são dado dos SÓCIOS (salário de cada um está aqui dentro), então a
 * regra é `isAdmin`, não `hasFullAccess`. Se um dia a Tainá precisar ver,
 * é trocar isAdmin por hasFullAccess nas três funções abaixo.
 */
async function requireSocio(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!isAdmin(member)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }
  return member;
}

const CATEGORIAS = CATEGORIAS_CUSTO.map((c) => c.value as string);

export async function addCompanyCostAction(formData: FormData) {
  const member = await requireSocio(formData);

  const descricao = String(formData.get("descricao") ?? "").trim();
  const valor = parseValorBR(String(formData.get("valor") ?? ""));
  if (!descricao || valor <= 0) return;

  const categoriaBruta = String(formData.get("categoria") ?? "ferramentas");
  const categoria = CATEGORIAS.includes(categoriaBruta)
    ? categoriaBruta
    : "outros";

  const competencia =
    String(formData.get("competencia") ?? "").trim() || competenciaAtual();
  const recorrente = formData.get("recorrente") === "on";
  const fornecedor = String(formData.get("fornecedor") ?? "").trim() || null;
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("company_costs").insert({
    descricao,
    categoria,
    valor,
    competencia,
    recorrente,
    fornecedor,
    observacao,
    registrado_por: member.name || member.email,
  });
  if (error) logServerError("custos.insert", error);

  revalidatePath("/admin/custos");
}

export async function deleteCompanyCostAction(formData: FormData) {
  await requireSocio(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("company_costs").delete().eq("id", id);
  if (error) logServerError("custos.delete", error);

  revalidatePath("/admin/custos");
}

/**
 * Repete os custos recorrentes do mês anterior no mês escolhido — sem isso a
 * pessoa relançaria salário e assinatura na mão todo mês, e o histórico (que
 * é o que revela reajuste) simplesmente não existiria.
 *
 * Não duplica o que já foi lançado: compara pela descrição.
 */
export async function repetirRecorrentesAction(formData: FormData) {
  const member = await requireSocio(formData);
  const competencia = String(formData.get("competencia") ?? "").trim();
  const origem = String(formData.get("origem") ?? "").trim();
  if (!competencia || !origem) return;

  const service = createSupabaseServiceRoleClient();
  const [{ data: anteriores }, { data: jaExistem }] = await Promise.all([
    service
      .from("company_costs")
      .select("*")
      .eq("competencia", origem)
      .eq("recorrente", true),
    service.from("company_costs").select("descricao").eq("competencia", competencia),
  ]);

  const existentes = new Set(
    ((jaExistem as { descricao: string }[] | null) ?? []).map((c) =>
      c.descricao.trim().toLowerCase()
    )
  );

  const novos = ((anteriores as Record<string, unknown>[] | null) ?? [])
    .filter(
      (c) => !existentes.has(String(c.descricao).trim().toLowerCase())
    )
    .map((c) => ({
      descricao: c.descricao,
      categoria: c.categoria,
      valor: c.valor,
      competencia,
      recorrente: true,
      fornecedor: c.fornecedor,
      observacao: c.observacao,
      registrado_por: member.name || member.email,
    }));

  if (novos.length > 0) {
    const { error } = await service.from("company_costs").insert(novos);
    if (error) logServerError("custos.repetir", error);
  }

  revalidatePath("/admin/custos");
}
