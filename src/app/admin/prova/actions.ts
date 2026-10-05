"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
  isDeveloper,
  telaInicialDe,
  type Member,
} from "@/lib/member";
import { nomeDoMembro } from "@/lib/member-notifications";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
import { problemaNoResultado, type TipoDeUso } from "@/lib/prova";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/uploads";
import { abrirProva, clienteDaProva } from "@/lib/prova-server";

/**
 * Escritas do Banco de prova.
 *
 * Duas regras do PRD são verificadas AQUI além do CHECK do banco, porque é
 * daqui que sai a mensagem pro humano: "resultado só com fonte e data" e
 * "nada sai como público sem nível de autorização registrado".
 */

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Quem mexe em prova.
 *
 * Lembrete do projeto: `getCurrentMember` é AUTENTICAÇÃO. A prova guarda
 * depoimento, autorização de uso de imagem e resultado de cliente — é
 * material comercial da agência, não trabalho de execução. Exige acesso
 * completo; o desenvolvedor nem vê a tela.
 */
async function exigirAcesso(urlKey: string | null): Promise<Member> {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (isDeveloper(member) || !hasFullAccess(member)) {
    redirect(`${telaInicialDe(member)}${keyParam(urlKey)}`);
  }
  return member;
}

function revalidar(proofId: string | null, clientId?: string | null) {
  revalidatePath("/admin/prova");
  if (proofId) revalidatePath(`/admin/prova/${proofId}`);
  if (clientId) revalidatePath(`/admin/${clientId}`);
}

/** Abre a prova de um cliente. Idempotente — ver `abrirProva`. */
export async function abrirProvaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await exigirAcesso(urlKey);
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!clientId) redirect(`/admin/prova${keyParam(urlKey)}`);

  // Escopo por cliente, mesmo pra quem tem acesso completo não ser o
  // caminho de burlar o recorte de quem não tem.
  const visiveis = await getVisibleClientIds(member);
  if (visiveis && !visiveis.has(clientId)) {
    redirect(`/admin/prova${keyParam(urlKey)}`);
  }

  const proofId = await abrirProva(clientId);
  if (!proofId) {
    redirect(`/admin/prova${keyParam(urlKey)}?erro=abrir`);
  }
  revalidar(proofId, clientId);
  redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
}

/** Segmento, serviço, cidade e site — o que faz a prova ser achável. */
export async function salvarFichaDaProvaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);
  const proofId = String(formData.get("proofId") ?? "").trim();
  const clientId = await clienteDaProva(proofId);
  if (!clientId) redirect(`/admin/prova${keyParam(urlKey)}`);

  const texto = (k: string, max: number) =>
    String(formData.get(k) ?? "").trim().slice(0, max) || null;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("proof_items")
    .update({
      segmento: texto("segmento", 80),
      servico: texto("servico", 80),
      cidade: texto("cidade", 80),
      site_url: texto("siteUrl", 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", proofId);
  if (error) logServerError("prova.ficha", error);

  revalidar(proofId, clientId);
  redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
}

/**
 * O resultado — com fonte e data, ou nada.
 *
 * O CHECK do banco também recusa, mas aqui a pessoa recebe a frase que diz
 * o que falta em vez de um erro 500.
 */
export async function salvarResultadoAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);
  const proofId = String(formData.get("proofId") ?? "").trim();
  const clientId = await clienteDaProva(proofId);
  if (!clientId) redirect(`/admin/prova${keyParam(urlKey)}`);

  const cru = {
    texto: String(formData.get("resultadoTexto") ?? ""),
    fonte: String(formData.get("resultadoFonte") ?? ""),
    data: String(formData.get("resultadoData") ?? ""),
  };
  const problema = problemaNoResultado(cru);
  if (problema) {
    redirect(
      `/admin/prova/${proofId}${keyParam(urlKey)}${urlKey ? "&" : "?"}erro=${encodeURIComponent(problema)}`
    );
  }

  const vazio = !cru.texto.trim();
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("proof_items")
    .update({
      resultado_texto: vazio ? null : cru.texto.trim().slice(0, 2000),
      resultado_fonte: vazio ? null : cru.fonte.trim().slice(0, 200),
      resultado_data: vazio ? null : cru.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proofId);
  if (error) logServerError("prova.resultado", error);

  revalidar(proofId, clientId);
  redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
}

/** O status da curadoria (a coletar → ... → aprovado para uso). */
export async function mudarStatusDaProvaAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await exigirAcesso(urlKey);
  const proofId = String(formData.get("proofId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const clientId = await clienteDaProva(proofId);
  if (!clientId) redirect(`/admin/prova${keyParam(urlKey)}`);

  const VALIDOS = [
    "a_coletar",
    "coletado",
    "conferido",
    "aprovado_para_uso",
    "usado",
    "sem_autorizacao",
    "arquivado",
  ];
  if (!VALIDOS.includes(status)) {
    redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  // "Conferido" é um ato da equipe: quem e quando ficam registrados, como
  // o `conferido_em` dos materiais do cliente.
  if (status === "conferido") {
    patch.conferido_por = nomeDoMembro(member.taskValue ?? "") || member.name;
    patch.conferido_em = new Date().toISOString();
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("proof_items")
    .update(patch)
    .eq("id", proofId);
  if (error) logServerError("prova.status", error);

  revalidar(proofId, clientId);
  redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
}

/**
 * Registra ONDE a prova foi usada.
 *
 * O PRD pede isso pra saber o que já rodou — e, de quebra, é o que impede
 * usar a mesma prova em cinco posts seguidos sem perceber.
 */
export async function registrarUsoAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);
  const proofId = String(formData.get("proofId") ?? "").trim();
  const clientId = await clienteDaProva(proofId);
  if (!clientId) redirect(`/admin/prova${keyParam(urlKey)}`);

  const tipo = String(formData.get("tipo") ?? "").trim() as TipoDeUso;
  if (!["post", "proposta", "pagina", "anuncio"].includes(tipo)) {
    redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
  }
  const link = String(formData.get("link") ?? "").trim().slice(0, 500) || null;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("proof_items")
    .select("usado_em")
    .eq("id", proofId)
    .maybeSingle();
  const atual = Array.isArray((data as { usado_em: unknown } | null)?.usado_em)
    ? ((data as { usado_em: unknown[] }).usado_em as unknown[])
    : [];

  const { error } = await service
    .from("proof_items")
    .update({
      usado_em: [
        ...atual,
        { tipo, link, data: new Date().toISOString().slice(0, 10) },
      ],
      updated_at: new Date().toISOString(),
    })
    .eq("id", proofId);
  if (error) logServerError("prova.uso", error);

  revalidar(proofId, clientId);
  redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
}

/** Onde moram as imagens da prova. Bucket público, como os comprovantes. */
const PROVA_BUCKET = "comprovantes";

/**
 * Pendura uma imagem na prova (antes, depois, logo, foto).
 *
 * Quando a captura automática de print existir — pendência que o PRD manda
 * decidir —, ela vai criar linhas nesta MESMA tabela com
 * `origem = 'automatico'`. Nada além do produtor do arquivo muda.
 */
export async function adicionarAssetAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);
  const proofId = String(formData.get("proofId") ?? "").trim();
  const clientId = await clienteDaProva(proofId);
  if (!clientId) redirect(`/admin/prova${keyParam(urlKey)}`);

  const tipo = String(formData.get("tipo") ?? "").trim();
  const dispositivo = String(formData.get("dispositivo") ?? "").trim();
  if (!["antes", "depois", "print", "logo", "foto"].includes(tipo)) {
    redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
  }

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/admin/prova/${proofId}${keyParam(urlKey)}${urlKey ? "&" : "?"}erro=${encodeURIComponent("Escolha um arquivo.")}`
    );
  }
  /**
   * O limite é o da Server Action na Vercel (~4,5 MB de corpo), não uma
   * preferência — acima dele a action nem roda e a tela volta sem dizer
   * nada. Ver src/lib/uploads.ts.
   */
  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(
      `/admin/prova/${proofId}${keyParam(urlKey)}${urlKey ? "&" : "?"}erro=${encodeURIComponent(`Imagem acima de ${MAX_UPLOAD_LABEL}. Mande um print menor.`)}`
    );
  }
  if (!file.type.startsWith("image/")) {
    redirect(
      `/admin/prova/${proofId}${keyParam(urlKey)}${urlKey ? "&" : "?"}erro=${encodeURIComponent("Só imagem por aqui.")}`
    );
  }

  const service = createSupabaseServiceRoleClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  const path = `prova/${proofId}/${Date.now()}-${safe}`;
  const { error: upErr } = await service.storage
    .from(PROVA_BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    logServerError("prova.asset-upload", upErr);
    redirect(
      `/admin/prova/${proofId}${keyParam(urlKey)}${urlKey ? "&" : "?"}erro=${encodeURIComponent("Não consegui subir a imagem.")}`
    );
  }

  const { error } = await service.from("proof_assets").insert({
    proof_id: proofId,
    tipo,
    dispositivo: ["desktop", "celular"].includes(dispositivo) ? dispositivo : null,
    storage_path: path,
    legenda: String(formData.get("legenda") ?? "").trim().slice(0, 300) || null,
    capturado_em: new Date().toISOString().slice(0, 10),
    origem: "upload",
  });
  if (error) logServerError("prova.asset", error);

  revalidar(proofId, clientId);
  redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
}

/** URL pública de uma imagem da prova. */
export async function urlDoAsset(path: string): Promise<string> {
  const service = createSupabaseServiceRoleClient();
  return service.storage.from(PROVA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Tira um arquivo da prova. */
export async function removerAssetAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await exigirAcesso(urlKey);
  const proofId = String(formData.get("proofId") ?? "").trim();
  const assetId = String(formData.get("assetId") ?? "").trim();
  const clientId = await clienteDaProva(proofId);
  if (!clientId || !assetId) redirect(`/admin/prova${keyParam(urlKey)}`);

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("proof_assets")
    .delete()
    .eq("id", assetId)
    // Preso à prova: o `assetId` vem do formulário, e sem isto daria pra
    // apagar o arquivo de outra prova mandando o id dela.
    .eq("proof_id", proofId);
  if (error) logServerError("prova.remover-asset", error);

  revalidar(proofId, clientId);
  redirect(`/admin/prova/${proofId}${keyParam(urlKey)}`);
}
