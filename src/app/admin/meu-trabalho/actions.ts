"use server";

import { getCurrentMember } from "@/lib/member";
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
