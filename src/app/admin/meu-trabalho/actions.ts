"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMember, hasFullAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";

/**
 * Endereço iCal da agenda, guardado NA CONTA da pessoa (não no navegador),
 * pra a agenda seguir ela em qualquer aparelho.
 *
 * A URL é CREDENCIAL (lê a agenda inteira). Por isso o servidor nunca a
 * devolve pro cliente: `getAgendaConfiguradaAction` responde só um booleano,
 * e quem busca os eventos é o servidor, em /api/admin/agenda.
 */

function ehUrlGoogleAgenda(valor: string): boolean {
  try {
    const u = new URL(valor);
    return (
      u.protocol === "https:" &&
      (u.hostname === "calendar.google.com" ||
        u.hostname.endsWith(".calendar.google.com"))
    );
  } catch {
    return false;
  }
}

export async function salvarAgendaIcsAction(
  icsUrl: string,
  urlKey: string | null
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const member = await getCurrentMember({ urlKey });
  if (!member) return { ok: false, erro: "unauthenticated" };
  if (member.source !== "supabase") {
    return { ok: false, erro: "sessao-sem-identidade-propria" };
  }
  if (!ehUrlGoogleAgenda(icsUrl)) {
    return { ok: false, erro: "url-invalida" };
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("team_members")
    .update({ agenda_ics_url: icsUrl })
    .eq("id", member.id);
  if (error) {
    logServerError("agenda.salvar", error);
    return { ok: false, erro: "save-failed" };
  }
  return { ok: true };
}

export async function removerAgendaIcsAction(
  urlKey: string | null
): Promise<{ ok: boolean }> {
  const member = await getCurrentMember({ urlKey });
  if (!member || member.source !== "supabase") return { ok: false };

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("team_members")
    .update({ agenda_ics_url: null })
    .eq("id", member.id);
  if (error) logServerError("agenda.remover", error);
  return { ok: !error };
}

/**
 * A pessoa já tem agenda salva na conta? Devolve só um booleano — a URL é
 * credencial e nunca vai pro navegador.
 */
export async function temAgendaNaContaAction(
  urlKey: string | null
): Promise<boolean> {
  const member = await getCurrentMember({ urlKey });
  if (!member || member.source !== "supabase") return false;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("team_members")
    .select("agenda_ics_url")
    .eq("id", member.id)
    .maybeSingle();
  return !!(data as { agenda_ics_url: string | null } | null)?.agenda_ics_url;
}

// ---------------------------------------------------------------------------
// Sync das demandas com o ClickUp. Pedido do usuário 2026-09-20:
// "ter bem certo as demandas de cada um (...) puxe tudo atualizado do click up".
// ---------------------------------------------------------------------------

/**
 * Traz do ClickUp responsável, status, prazo e prioridade de cada demanda,
 * e depois preenche com o dono padrão o que continuou sem ninguém.
 *
 * Não cria nem apaga tarefa: o app tem etapas que o ClickUp não tem
 * (Pagamento, Envio Contrato) e sobrescrever perderia trabalho.
 */
export async function sincronizarDemandasAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Mexe na demanda da equipe inteira — não é ação de quem só vê a própria.
  if (!hasFullAccess(member)) {
    redirect(`/admin/meu-trabalho${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

  const { sincronizarTarefasDoClickUp, preencherDonosPadrao } = await import(
    "@/lib/clickup-tasks-sync"
  );

  const sp = new URLSearchParams();
  if (urlKey) sp.set("key", urlKey);

  const r = await sincronizarTarefasDoClickUp();
  if (!r.ok) {
    logServerError("sincronizarDemandasAction", new Error(r.reason ?? "falhou"));
    sp.set("sync", "erro");
    if (r.reason) sp.set("motivo", r.reason);
    redirect(`/admin/meu-trabalho?${sp.toString()}`);
  }

  const padrao = await preencherDonosPadrao();

  sp.set("sync", "ok");
  sp.set(
    "res",
    [
      r.criadas,
      r.vinculadas,
      r.ignoradasSemPrazo,
      r.responsavelDefinido,
      r.statusAtualizado,
      r.prazoAtualizado,
      padrao.preenchidas,
      r.internasCriadas,
    ].join("-")
  );
  revalidatePath("/admin/meu-trabalho");
  revalidatePath("/admin/tarefas");
  redirect(`/admin/meu-trabalho?${sp.toString()}`);
}
