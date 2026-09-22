"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember, hasFullAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
import { TEAM_MEMBERS_INTERNOS } from "@/lib/project-tasks";
import {
  montarMapa,
  normalizarFrente,
  normalizarNota,
  normalizarStatus,
} from "@/lib/prioridades";
import { listarIniciativas } from "@/lib/prioridades-server";

/**
 * Escrita das iniciativas de melhoria (/admin/prioridades).
 *
 * Tudo aqui é POST via <form action={...}> — nenhuma destas ações pode virar
 * link/GET: o <Link> do Next faz prefetch e dispararia a mutação sozinho.
 *
 * Autorização: `hasFullAccess` em TODAS as ações, não só na page. Esta tela
 * expõe onde a agência vai investir e o que trava o faturamento — o mesmo
 * corte de /admin/demandas. `getCurrentMember` é autenticação; quem autoriza
 * é a checagem abaixo, e ela roda de novo a cada escrita porque esconder o
 * item do menu não impede ninguém de dar POST na Server Action.
 */

const TELA = "/admin/prioridades";

async function exigirAcessoCompleto(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) {
    redirect(`/admin/meu-trabalho${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }
}

/** Texto curto vindo do form: vazio vira null, não string vazia. */
function texto(formData: FormData, campo: string): string | null {
  const v = String(formData.get(campo) ?? "").trim();
  return v ? v : null;
}

/** Responsável só vale se for alguém da equipe interna (TEAM_MEMBERS). */
function responsavel(formData: FormData): string | null {
  const v = String(formData.get("responsavel") ?? "").trim();
  if (!v) return null;
  return TEAM_MEMBERS_INTERNOS.some((m) => m.value === v) ? v : null;
}

export async function criarIniciativaAction(formData: FormData) {
  await exigirAcessoCompleto(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return;

  const service = createSupabaseServiceRoleClient();
  // Entra no fim da fila. `ordem` só é comparada dentro do grupo da tela, e
  // o maior valor global garante que ela nasça por último em qualquer um.
  const { data: ultimo } = await service
    .from("improvement_initiatives")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = ((ultimo as { ordem: number } | null)?.ordem ?? 0) + 1;

  const { error } = await service.from("improvement_initiatives").insert({
    titulo,
    detalhe: texto(formData, "detalhe"),
    frente: normalizarFrente(formData.get("frente")),
    impacto: normalizarNota(formData.get("impacto")),
    esforco: normalizarNota(formData.get("esforco")),
    ganho: texto(formData, "ganho"),
    responsavel: responsavel(formData),
    status: normalizarStatus(formData.get("status")),
    ordem,
  });
  if (error) logServerError("prioridades.criar", error);

  revalidatePath(TELA);
}

/**
 * Salva só os campos que vieram no FormData — cada controle da tela manda o
 * seu (o seletor de frente manda `frente`, o par de notas manda
 * `impacto`+`esforco`, o form de edição manda os textos). A lista de chaves
 * aceitas é fechada aqui dentro: nada do que chega do navegador vira nome de
 * coluna.
 */
export async function salvarIniciativaAction(formData: FormData) {
  await exigirAcessoCompleto(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const patch: Record<string, string | number | null> = {};
  if (formData.has("titulo")) {
    const titulo = String(formData.get("titulo") ?? "").trim();
    // Título é obrigatório: form enviado em branco não apaga o que existe.
    if (!titulo) return;
    patch.titulo = titulo;
  }
  if (formData.has("detalhe")) patch.detalhe = texto(formData, "detalhe");
  if (formData.has("ganho")) patch.ganho = texto(formData, "ganho");
  if (formData.has("frente")) patch.frente = normalizarFrente(formData.get("frente"));
  if (formData.has("status")) patch.status = normalizarStatus(formData.get("status"));
  if (formData.has("responsavel")) patch.responsavel = responsavel(formData);
  if (formData.has("impacto")) patch.impacto = normalizarNota(formData.get("impacto"));
  if (formData.has("esforco")) patch.esforco = normalizarNota(formData.get("esforco"));
  if (Object.keys(patch).length === 0) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("improvement_initiatives")
    .update(patch)
    .eq("id", id);
  if (error) logServerError("prioridades.salvar", error);

  revalidatePath(TELA);
}

export async function removerIniciativaAction(formData: FormData) {
  await exigirAcessoCompleto(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("improvement_initiatives")
    .delete()
    .eq("id", id);
  if (error) logServerError("prioridades.remover", error);

  revalidatePath(TELA);
}

/**
 * Move uma posição pra cima/baixo DENTRO do grupo em que a iniciativa
 * aparece na tela (quadrante, ou "feito"). O grupo não está gravado em
 * lugar nenhum — sai de impacto+esforço+status pela mesma função que o
 * gráfico usa (`montarMapa`), então servidor e tela nunca discordam de quem
 * é o vizinho.
 *
 * Em vez de trocar o `ordem` com o vizinho, regrava o grupo inteiro em
 * 0,1,2… — trocar valores falha em silêncio quando dois itens têm o mesmo
 * `ordem` (acontece: item novo e item que mudou de quadrante).
 */
export async function moverIniciativaAction(formData: FormData) {
  await exigirAcessoCompleto(formData);
  const id = String(formData.get("id") ?? "");
  const direcao = String(formData.get("direcao") ?? "");
  if (!id || (direcao !== "cima" && direcao !== "baixo")) return;

  const mapa = montarMapa(await listarIniciativas());
  const alvo = mapa.find((i) => i.id === id);
  if (!alvo) return;

  const grupo = mapa.filter((i) => i.grupo === alvo.grupo);
  const pos = grupo.findIndex((i) => i.id === id);
  const destino = direcao === "cima" ? pos - 1 : pos + 1;
  if (destino < 0 || destino >= grupo.length) return;

  const novo = [...grupo];
  [novo[pos], novo[destino]] = [novo[destino], novo[pos]];

  const service = createSupabaseServiceRoleClient();
  const escritas = novo
    .map((item, idx) => ({ item, idx }))
    .filter(({ item, idx }) => item.ordem !== idx)
    .map(({ item, idx }) =>
      service
        .from("improvement_initiatives")
        .update({ ordem: idx })
        .eq("id", item.id)
    );
  const resultados = await Promise.all(escritas);
  const falha = resultados.find((r) => r.error);
  if (falha?.error) logServerError("prioridades.mover", falha.error);

  revalidatePath(TELA);
}
