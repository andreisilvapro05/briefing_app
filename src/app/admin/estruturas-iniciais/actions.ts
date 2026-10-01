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
import { logServerError } from "@/lib/api-helpers";
import { generateMagicSlug } from "@/lib/slug";
import { getTemplateDocument } from "@/lib/ei-documents-server";

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

/**
 * Cria o documento de um cliente, duplicado do Modelo. Idempotente: se o
 * cliente já tem um documento, só redireciona pra ele (evita duplicar se
 * o admin clicar duas vezes).
 */
export async function createEIDocumentAction(formData: FormData) {
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
  // `kind` permite reaproveitar esta action pro documento de Briefing: o
  // fluxo é o mesmo (clona o Modelo), só muda a tela de destino.
  const kind = formData.get("kind") === "briefing" ? "briefing" : "ei";

  /**
   * Cliente que ainda não existe, criado aqui mesmo.
   *
   * Karine (01/10): "nem sempre tem cliente... poder adicionar eu mesmo
   * ali o nome do cliente e já fazer o briefing com ele". O briefing de
   * chamada costuma ser o PRIMEIRO contato: exigir a ficha antes obriga a
   * sair da tela no meio da conversa.
   *
   * Mora AQUI e não na action do outro hub porque é por esta que as duas
   * telas passam — a de /admin/briefings usa `criarBriefingAction`, que
   * só repassa pra cá. (Na primeira versão isto ficou na outra, e por
   * isso não funcionava justamente na tela da lista de briefings.)
   */
  const nomeNovo = String(formData.get("nomeNovoCliente") ?? "").trim().slice(0, 120);
  if (!clientId && nomeNovo) {
    if (!hasFullAccess(member)) {
      redirect(`/admin/briefings${keyParam(urlKey)}`);
    }
    const svc = createSupabaseServiceRoleClient();
    const { data: criado, error: erroNovo } = await svc
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
      logServerError("documento.criar-cliente", erroNovo);
      redirect(`/admin/briefings${keyParam(urlKey)}`);
    }
    clientId = (criado as { id: string }).id;
  }
  const destino = (docId: string) =>
    kind === "briefing"
      ? `/admin/briefings/doc/${docId}${keyParam(urlKey)}`
      : `/admin/estruturas-iniciais/${docId}${keyParam(urlKey)}`;
  if (!clientId) return;
  if (!hasFullAccess(member)) {
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(clientId)) redirect(`/admin/estruturas-iniciais${keyParam(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();

  // `novo` = duplicar o Modelo mesmo que o cliente já tenha um documento.
  // A migration 20260922120000 já tinha liberado vários por cliente no
  // banco; faltava a tela e esta função permitirem.
  const novo = String(formData.get("novo") ?? "") === "1";

  if (!novo) {
    const { data: existing } = await service
      .from("ei_documents")
      .select("id")
      .eq("client_id", clientId)
      .eq("kind", kind)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing) {
      redirect(destino((existing as { id: string }).id));
    }
  }

  /**
   * De QUAL modelo este documento nasce.
   *
   * Karine (01/10): "ter modelos de briefing de site, landing page
   * negócio, landing page produto digital". Havia um Modelo só, e todo
   * briefing nascia dele — site e landing de produto começam com
   * perguntas diferentes, e apagar metade a cada chamada é trabalho
   * jogado fora. Sem `templateId`, segue no modelo padrão de sempre.
   */
  const templateId = String(formData.get("templateId") ?? "").trim();
  let blocks: unknown[] = [];
  if (templateId) {
    const { data: modelo } = await service
      .from("ei_documents")
      .select("ei_data, kind, is_template")
      .eq("id", templateId)
      .maybeSingle();
    const m = modelo as
      | { ei_data: { blocks?: unknown[] } | null; kind: string; is_template: boolean }
      | null;
    // Só um MODELO do mesmo tipo: sem isso, um id qualquer copiaria o
    // documento de outro cliente pra dentro deste.
    if (m?.is_template && m.kind === kind) {
      blocks = Array.isArray(m.ei_data?.blocks) ? m.ei_data.blocks : [];
    }
  }
  if (blocks.length === 0) {
    const template = await getTemplateDocument(kind);
    blocks = template?.blocks ?? [];
  }

  const { data: created, error } = await service
    .from("ei_documents")
    .insert({ client_id: clientId, kind, ei_data: { blocks } })
    .select("id")
    .single();
  if (error || !created) {
    logServerError("documento.criar", error ?? new Error("sem linha"));
    return;
  }

  revalidatePath("/admin/estruturas-iniciais");
  revalidatePath("/admin/briefings");
  revalidatePath(`/admin/${clientId}`);

  redirect(destino((created as { id: string }).id));
}

/**
 * Autosave: grava os blocos inteiros de um documento (Modelo ou cliente).
 * Disparado debounced a cada mudança no editor (ver EIBlockEditor).
 */
export async function updateEIDocumentAction(formData: FormData) {
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

  const docId = String(formData.get("docId") ?? "");
  if (!docId) return;

  const raw = String(formData.get("eiJson") ?? "").trim();
  if (!raw) return;

  let parsed: { blocks: unknown[] };
  try {
    parsed = JSON.parse(raw) as { blocks: unknown[] };
  } catch (err) {
    logServerError("ei.blocos-json-invalido", err);
    return;
  }

  const service = createSupabaseServiceRoleClient();

  if (!hasFullAccess(member)) {
    // Resolve o client_id REAL do documento (não confia em nada vindo do
    // form) — doc sem cliente é o Modelo, só admin/avancado edita esse.
    const { data: doc } = await service
      .from("ei_documents")
      .select("client_id")
      .eq("id", docId)
      .maybeSingle();
    const docClientId = (doc as { client_id: string | null } | null)
      ?.client_id;
    if (!docClientId) return;
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(docClientId)) return;
  }

  const { error: escritaErr1 } = await service
    .from("ei_documents")
    .update({ ei_data: parsed, updated_at: new Date().toISOString() })
    .eq("id", docId);
  if (escritaErr1) logServerError("ei.escrita", escritaErr1);

  revalidatePath(`/admin/estruturas-iniciais/${docId}`);
}
