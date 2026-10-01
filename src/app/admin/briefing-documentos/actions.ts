"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  isDeveloper,
  telaInicialDe,
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { generateMagicSlug } from "@/lib/slug";
import { logServerError } from "@/lib/api-helpers";
import { getTemplateDocument } from "@/lib/ei-documents-server";

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Cria o documento de briefing de um cliente, duplicado do Modelo — mesmo
 * padrão de createEIDocumentAction (estruturas-iniciais/actions.ts), kind
 * "briefing" em vez de "ei". Idempotente: se o cliente já tem um, só
 * redireciona pra ele.
 */
export async function createBriefingDocumentAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Desenvolvedor: tem tarefa no cliente e passaria no escopo, mas escrever
  // aqui não é dele. A tela ele não vê; a Server Action é POST direto.
  if (isDeveloper(member)) {
    redirect(
      `${telaInicialDe(member)}${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`
    );
  }

  let clientId = String(formData.get("clientId") ?? "");

  /**
   * Cliente que ainda não existe, criado aqui mesmo.
   *
   * Karine (01/10): "nem sempre tem cliente... poder adicionar eu mesmo
   * ali o nome do cliente e já fazer o briefing com ele". O briefing de
   * chamada costuma ser o PRIMEIRO contato — exigir que a ficha exista
   * antes obrigava a sair da tela, cadastrar e voltar, no meio da
   * conversa com a pessoa do outro lado.
   *
   * Nasce com o mínimo: nome e o slug do painel. O resto (WhatsApp,
   * contrato, valores) entra depois, pela ficha.
   */
  const nomeNovo = String(formData.get("nomeNovoCliente") ?? "").trim().slice(0, 120);
  if (!clientId && nomeNovo) {
    // Criar cliente é escrita de operação — não de quem só tem tarefa.
    if (!hasFullAccess(member)) {
      redirect(`/admin/briefing-documentos${keyParam(urlKey)}`);
    }
    const servicoNovo = createSupabaseServiceRoleClient();
    const { data: criado, error: erroNovo } = await servicoNovo
      .from("clients")
      .insert({
        nome: nomeNovo,
        email: "",
        empresa: "",
        whatsapp: "",
        magic_slug: generateMagicSlug({ nome: nomeNovo, empresa: null }),
      })
      .select("id")
      .single();
    if (erroNovo || !criado) {
      logServerError("briefing.criar-cliente", erroNovo);
      redirect(`/admin/briefing-documentos${keyParam(urlKey)}`);
    }
    clientId = (criado as { id: string }).id;
  }

  if (!clientId) return;
  if (!hasFullAccess(member)) {
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(clientId)) redirect(`/admin/briefing-documentos${keyParam(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();

  /**
   * `novo` = duplicar o Modelo mesmo que o cliente já tenha um briefing.
   *
   * Pedido da Karine (26/09): "preciso que fique bom pra mim duplicar o
   * modelo de briefing e fazer com o cliente em chamada pelo app". Sem
   * isso, os 32 clientes que já têm briefing (vindos da importação do
   * ClickUp) não tinham como ganhar um novo — e é justamente com cliente
   * antigo que uma chamada de briefing novo acontece, num segundo projeto.
   *
   * O banco sempre permitiu vários: não há índice único em
   * (client_id, kind). Quem proibia era esta função.
   */
  const novo = String(formData.get("novo") ?? "") === "1";

  if (!novo) {
    // `.maybeSingle()` ESTOURA com mais de uma linha, e vários clientes já
    // têm dois briefings (35 documentos para 32 clientes em 26/09). Pega o
    // mais recente em vez de quebrar.
    const { data: existing } = await service
      .from("ei_documents")
      .select("id")
      .eq("client_id", clientId)
      .eq("kind", "briefing")
      .order("updated_at", { ascending: false })
      .limit(1);
    const atual = (existing as { id: string }[] | null)?.[0];
    if (atual) {
      redirect(`/admin/briefing-documentos/${atual.id}${keyParam(urlKey)}`);
    }
  }

  const template = await getTemplateDocument("briefing");
  const blocks = template?.blocks ?? [];

  const { data: created } = await service
    .from("ei_documents")
    .insert({ client_id: clientId, kind: "briefing", ei_data: { blocks } })
    .select("id")
    .single();

  revalidatePath("/admin/briefing-documentos");
  revalidatePath(`/admin/${clientId}`);

  redirect(
    `/admin/briefing-documentos/${(created as { id: string }).id}${keyParam(urlKey)}`
  );
}

/**
 * Apaga um briefing de vez.
 *
 * Karine (01/10): "poder excluir o briefing também". A tela acumulava
 * duplicatas e testes — clone do Modelo criado por engano, briefing de
 * chamada que não aconteceu — e não havia como tirá-los da lista.
 *
 * Apaga MESMO, não arquiva: o caso real é lixo, e um arquivo cheio de
 * lixo é a mesma bagunça num lugar menos visível. Por isso exige acesso
 * completo e confirmação na tela.
 *
 * O MODELO é protegido: ele é a origem de todo briefing novo, e apagá-lo
 * quebraria a criação pra sempre.
 */
export async function excluirBriefingAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (isDeveloper(member) || !hasFullAccess(member)) {
    redirect(`/admin/briefings${keyParam(urlKey)}`);
  }

  const docId = String(formData.get("docId") ?? "");
  if (!docId) return;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("id, kind, is_template")
    .eq("id", docId)
    .maybeSingle();
  const doc = data as { kind: string; is_template: boolean } | null;
  // Só briefing, e nunca o Modelo.
  if (!doc || doc.kind !== "briefing" || doc.is_template) {
    redirect(`/admin/briefings${keyParam(urlKey)}`);
  }

  const { error } = await service.from("ei_documents").delete().eq("id", docId);
  if (error) {
    logServerError("briefing.excluir", error);
    redirect(`/admin/briefings/doc/${docId}${keyParam(urlKey)}`);
  }

  revalidatePath("/admin/briefings");
  revalidatePath("/admin/briefing-documentos");
  redirect(`/admin/briefings${keyParam(urlKey)}`);
}
