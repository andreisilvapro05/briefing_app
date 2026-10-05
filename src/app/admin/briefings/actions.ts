"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
import type { CustomQuestionTipo } from "@/lib/custom-questions";
import type { TemplateQuestion } from "@/lib/briefing-templates";
import { getBriefingTemplate } from "@/lib/briefing-templates-server";
import { createEIDocumentAction } from "@/app/admin/estruturas-iniciais/actions";
import { eiDocumentTitle, nomeDaCopia } from "@/lib/ei-documents";

/**
 * Ações da aba global "Briefings" — templates reutilizáveis.
 *
 * Um template é um conjunto de perguntas guardado em briefing_templates
 * (perguntas: jsonb). "Aplicar a um cliente" copia essas perguntas pra
 * client_custom_questions do cliente, que já é renderizado no briefing dele.
 */

function keySuffix(urlKey: string | null): string {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

function normalizeTipo(v: unknown): CustomQuestionTipo {
  return v === "texto-curto" || v === "escolha" ? v : "texto-longo";
}

/** Sanitiza o array de perguntas vindo do builder (JSON no FormData). */
function parsePerguntas(raw: string): TemplateQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item, i): TemplateQuestion | null => {
      const row = (item ?? {}) as Record<string, unknown>;
      const label = String(row.label ?? "").trim();
      if (!label) return null;
      const tipo = normalizeTipo(row.tipo);
      const opcoes =
        tipo === "escolha" && Array.isArray(row.opcoes)
          ? row.opcoes.map((o) => String(o).trim()).filter(Boolean)
          : [];
      const hint = String(row.hint ?? "").trim();
      return {
        id: String(row.id ?? `q-${i}`),
        label,
        hint: hint || null,
        tipo,
        opcoes,
        ordem: i,
      };
    })
    .filter((q): q is TemplateQuestion => q !== null);
}

/**
 * Cria um template vazio (só nome) e leva pro builder pra montar as perguntas.
 */
/**
 * Modelo de briefing é config GLOBAL da agência: um modelo apagado some da
 * ficha de todo cliente. `getAdminUser` aceitava qualquer membro logado,
 * inclusive o papel "basico" (designer) — que não deveria nem ver a tela.
 */
async function requireAcessoTotal(urlKey: string | null) {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) {
    redirect(`/admin/briefings${keySuffix(urlKey)}`);
  }
  return member;
}

export async function createBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await requireAcessoTotal(urlKey);
  void member;

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;

  const service = createSupabaseServiceRoleClient();
  const { data: created } = await service
    .from("briefing_templates")
    .insert({ nome, perguntas: [] })
    .select("id")
    .single();

  revalidatePath("/admin/briefings");
  if (created?.id) {
    redirect(`/admin/briefings/${created.id}${keySuffix(urlKey)}`);
  }
  redirect(`/admin/briefings${keySuffix(urlKey)}`);
}

/**
 * Salva nome + perguntas do template (o builder manda o array inteiro em JSON).
 */
export async function saveBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await requireAcessoTotal(urlKey);
  void member;

  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;

  const perguntas = parsePerguntas(String(formData.get("perguntas") ?? "[]"));

  const service = createSupabaseServiceRoleClient();
  const { error: updErr } = await service
    .from("briefing_templates")
    .update({ nome, perguntas, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) logServerError("briefings.template.update", updErr);

  revalidatePath("/admin/briefings");
  revalidatePath(`/admin/briefings/${id}`);
}

/**
 * Remove um template. Não afeta perguntas já aplicadas a clientes (aquelas
 * já foram copiadas pra client_custom_questions).
 */
export async function deleteBriefingTemplateAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await requireAcessoTotal(urlKey);
  void member;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const service = createSupabaseServiceRoleClient();
  const { error: delErr } = await service
    .from("briefing_templates")
    .delete()
    .eq("id", id);
  if (delErr) logServerError("briefings.template.delete", delErr);

  revalidatePath("/admin/briefings");
  redirect(`/admin/briefings${keySuffix(urlKey)}`);
}

/**
 * Aplica um template a um cliente: copia cada pergunta do template pra
 * client_custom_questions daquele cliente (anexando depois das que já existem).
 * Depois disso, as perguntas viram o bloco extra no briefing do cliente.
 *
 * Redireciona pro cliente (aba briefing) pra o admin ver o resultado.
 */
export async function applyTemplateToClientAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  // requireAcessoTotal já exige sessão E acesso completo. O escopo por
  // cliente abaixo é redundante pra quem passa dali (acesso completo vê
  // tudo), mas fica como cinto e suspensório — e sem o `if (quem)` de
  // antes, que parecia deixar passar sem sessão e confundia quem lia.
  const member = await requireAcessoTotal(urlKey);

  const templateId = String(formData.get("templateId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!templateId || !clientId) return;

  const visiveis = await getVisibleClientIds(member);
  if (visiveis && !visiveis.has(clientId)) {
    redirect(`/admin/briefings${keySuffix(urlKey)}`);
  }

  const template = await getBriefingTemplate(templateId);
  if (!template || template.perguntas.length === 0) {
    redirect(`/admin/briefings/${templateId}${keySuffix(urlKey)}`);
  }

  const service = createSupabaseServiceRoleClient();

  // Anexa DEPOIS das perguntas específicas que o cliente já tenha. Usa
  // (maior ordem existente) + 1 em vez de count — porque delete não renumera
  // e deixa buracos, então count subestimaria a ordem e intercalaria as novas
  // perguntas no meio do briefing.
  const { data: maxRow } = await service
    .from("client_custom_questions")
    .select("ordem")
    .eq("client_id", clientId)
    .order("ordem", { ascending: false })
    .limit(1);
  const offset =
    (Array.isArray(maxRow) && maxRow.length
      ? Number((maxRow[0] as { ordem: number }).ordem ?? -1)
      : -1) + 1;

  const rows = template!.perguntas.map((q, i) => ({
    client_id: clientId,
    label: q.label,
    hint: q.hint,
    tipo: q.tipo,
    opcoes: q.opcoes,
    ordem: offset + i,
  }));

  const { error: insErr } = await service
    .from("client_custom_questions")
    .insert(rows);
  if (insErr) logServerError("briefings.aplicar-template", insErr);

  revalidatePath(`/admin/${clientId}`);
  /**
   * `?tab=briefing`, não `#briefing`.
   *
   * A ficha escolhe a aba pela QUERY STRING; não existe nenhum
   * `id="briefing"` no app pra âncora pegar. Quem aplicava um modelo de
   * perguntas a um cliente caía na aba "geral" e não via o resultado —
   * justamente o que esta função existe pra mostrar.
   */
  redirect(
    `/admin/${clientId}${keySuffix(urlKey) ? `${keySuffix(urlKey)}&` : "?"}tab=briefing`
  );
}

// ---------------------------------------------------------------------------
// Briefing como documento próprio: importação do ClickUp e link público.
// Pedido do usuário 2026-09-20.
// ---------------------------------------------------------------------------

/**
 * Puxa as páginas do doc de briefings do ClickUp pro app, fiel ao conteúdo
 * (caixinhas marcadas, links, divisores). Idempotente: rodar de novo
 * atualiza o que mudou lá em vez de duplicar.
 */
export async function importarBriefingsAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { importarBriefingsDoClickUp } = await import("@/lib/briefings-server");
  const r = await importarBriefingsDoClickUp();

  const sp = new URLSearchParams();
  if (urlKey) sp.set("key", urlKey);
  if (!r.ok) {
    logServerError("importarBriefingsAction", new Error(r.reason ?? "falhou"));
    sp.set("imp", "erro");
    if (r.reason) sp.set("motivo", r.reason);
  } else {
    sp.set("imp", "ok");
    sp.set(
      "res",
      [r.criados, r.atualizados, r.semCliente, r.credenciaisProtegidas, r.preservados].join("-")
    );
  }
  revalidatePath("/admin/briefings");
  redirect(`/admin/briefings?${sp.toString()}`);
}

/** Liga o link público do briefing (token próprio, não o magic_slug). */
export async function compartilharBriefingAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = (formData.get("id") as string | null) ?? "";
  const dias = Number(formData.get("dias") ?? "");
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Criar link público é decisão de quem tem visão completa — não do papel
  // "basico", que é justamente de quem o briefing deve ficar separado.
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { ativarCompartilhamento } = await import("@/lib/briefings-server");
  const r = await ativarCompartilhamento(id, {
    expiraEmDias: Number.isFinite(dias) && dias > 0 ? dias : null,
  });
  if ("erro" in r) logServerError("compartilharBriefingAction", new Error(r.erro));

  revalidatePath(`/admin/briefings/doc/${id}`);
  redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
}

/** Revoga o link. Troca o token: o link antigo não volta a valer. */
export async function revogarCompartilhamentoAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = (formData.get("id") as string | null) ?? "";
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { revogarCompartilhamento } = await import("@/lib/briefings-server");
  await revogarCompartilhamento(id);

  revalidatePath(`/admin/briefings/doc/${id}`);
  redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
}

/** Vincula (ou desvincula) o briefing avulso a um cliente. */
export async function vincularBriefingAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = (formData.get("id") as string | null) ?? "";
  const clientId = ((formData.get("clientId") as string | null) ?? "").trim();
  const { getCurrentMember, hasFullAccess } = await import("@/lib/member");
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const { vincularBriefingACliente } = await import("@/lib/briefings-server");
  await vincularBriefingACliente(id, clientId || null);

  revalidatePath(`/admin/briefings/doc/${id}`);
  redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
}

/**
 * Criar briefing pelo botão do topo da barra lateral do hub.
 *
 * Pedido da Karine (28/09): "criar um novo fácil". A action de Estruturas
 * Iniciais já faz exatamente isto — clona o Modelo do `kind` pedido e, com
 * kind "briefing", já volta pra /admin/briefings/doc/{id}. O que falta é o
 * `kind`: o formulário quem monta é o EIDocumentSidebar, no cliente, e ele
 * só manda clientId/novo/key. Daí este invólucro, em vez de um campo
 * escondido que só este uso da barra lateral teria.
 *
 * Reaproveitar em vez de copiar mantém a autorização num lugar só
 * (desenvolvedor barrado, escopo por cliente de quem não tem visão total).
 */
export async function criarBriefingAction(formData: FormData) {
  formData.set("kind", "briefing");
  await createEIDocumentAction(formData);
}

/**
 * Renomear um briefing.
 *
 * Karine (04/10): "poder editar". Até aqui o briefing NÃO tinha nome
 * próprio editável — `eiDocumentTitle` sempre mostrava o nome do cliente,
 * então os três briefings da mesma pessoa apareciam idênticos na lista.
 *
 * Nome vazio APAGA o nome próprio e devolve o título pro nome do cliente,
 * que é o padrão. É o jeito de desfazer sem um segundo botão.
 */
export async function renomearBriefingAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = String(formData.get("docId") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 160);

  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({ nome: nome || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("kind", "briefing");
  if (error) logServerError("briefing.renomear", error);

  revalidatePath("/admin/briefings");
  revalidatePath(`/admin/briefings/doc/${id}`);
  redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
}

/**
 * Duplicar um briefing — com o conteúdo, não só a casca.
 *
 * Karine (04/10): "poder duplicar". O caso real é o segundo projeto do
 * mesmo cliente: aproveita-se o que já foi levantado e muda-se o que é
 * novo. Criar do Modelo em branco jogaria fora justamente a parte cara.
 *
 * O que NÃO vai junto, de propósito:
 *   - `share_token` / `share_enabled`: o link que o cliente já tem aponta
 *     pro briefing ORIGINAL. Herdar o token faria duas páginas
 *     responderem pelo mesmo endereço.
 *   - `is_template`: cópia de modelo nasce documento comum, senão o app
 *     passaria a ter dois "Modelo" e `getTemplateDocument` ficaria
 *     ambíguo — armadilha que já quebrou a criação de briefing uma vez.
 *   - `credenciais`: senha de cliente não se multiplica por engano.
 */
export async function duplicarBriefingAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const id = String(formData.get("docId") ?? "").trim();

  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) redirect(`/admin/briefings${keySuffix(urlKey)}`);
  if (!id) redirect(`/admin/briefings${keySuffix(urlKey)}`);

  const service = createSupabaseServiceRoleClient();
  const { data: origemRow, error: erroLeitura } = await service
    .from("ei_documents")
    .select("id, client_id, nome, is_template, kind, ei_data, clients(nome, empresa)")
    .eq("id", id)
    .eq("kind", "briefing")
    .maybeSingle();
  if (erroLeitura || !origemRow) {
    logServerError("briefing.duplicar.leitura", erroLeitura);
    redirect(`/admin/briefings${keySuffix(urlKey)}`);
  }
  const origem = origemRow as unknown as {
    client_id: string | null;
    nome: string | null;
    is_template: boolean;
    ei_data: { blocks?: unknown[] } | null;
    clients: { nome: string | null; empresa: string | null } | null;
  };

  // Os nomes já usados — pra cópia da cópia virar "(cópia 2)" e não
  // colidir. Entre os do MESMO cliente; documento avulso compara com os
  // avulsos.
  const irmasQuery = service
    .from("ei_documents")
    .select("nome, is_template, clients(nome, empresa)")
    .eq("kind", "briefing");
  const { data: irmas } = await (origem.client_id
    ? irmasQuery.eq("client_id", origem.client_id)
    : irmasQuery.is("client_id", null));

  const tituloOrigem = eiDocumentTitle({
    isTemplate: origem.is_template,
    nome: origem.nome,
    client: origem.clients,
  });
  const usados = ((irmas as unknown as {
    nome: string | null;
    is_template: boolean;
    clients: { nome: string | null; empresa: string | null } | null;
  }[] | null) ?? []).map((r) =>
    eiDocumentTitle({
      isTemplate: r.is_template,
      nome: r.nome,
      client: r.clients,
    })
  );

  const { data: criado, error: erroInsert } = await service
    .from("ei_documents")
    .insert({
      client_id: origem.client_id,
      kind: "briefing",
      nome: nomeDaCopia(tituloOrigem, usados),
      ei_data: { blocks: origem.ei_data?.blocks ?? [] },
    })
    .select("id")
    .single();
  if (erroInsert || !criado) {
    logServerError("briefing.duplicar", erroInsert);
    redirect(`/admin/briefings/doc/${id}${keySuffix(urlKey)}`);
  }

  revalidatePath("/admin/briefings");
  redirect(
    `/admin/briefings/doc/${(criado as { id: string }).id}${keySuffix(urlKey)}`
  );
}
