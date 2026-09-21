"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember, isAdmin } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { gerarChave } from "@/lib/api-keys";
import { logServerError } from "@/lib/api-helpers";

function comKey(urlKey: string | null, extra?: Record<string, string>): string {
  const sp = new URLSearchParams();
  if (urlKey) sp.set("key", urlKey);
  for (const [k, v] of Object.entries(extra ?? {})) sp.set(k, v);
  const s = sp.toString();
  return `/admin/chaves-api${s ? `?${s}` : ""}`;
}

/**
 * Cria uma chave só-leitura. A chave em claro volta UMA vez, na querystring
 * (`?nova=`), e nunca é gravada — o banco só guarda o SHA-256. Se a pessoa
 * perder, o caminho é revogar e gerar outra.
 */
export async function criarChaveApiAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Chave dá acesso a dado de produção sem senha — só sócio cria.
  if (!isAdmin(member)) redirect(comKey(urlKey));

  const nome = ((formData.get("nome") as string | null) ?? "").trim();
  const responsavel =
    ((formData.get("responsavel") as string | null) ?? "").trim() || null;

  if (!nome) redirect(comKey(urlKey, { erro: "nome" }));

  const { bruta, hash } = gerarChave();
  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("api_keys").insert({
    nome,
    token_hash: hash,
    member_id: member.source === "supabase" ? member.id : null,
    responsavel,
    escopo: "demandas:read",
    criada_por: member.email ?? null,
  });

  if (error) {
    logServerError("criarChaveApiAction", error);
    redirect(comKey(urlKey, { erro: "banco" }));
  }

  revalidatePath("/admin/chaves-api");
  redirect(comKey(urlKey, { nova: bruta }));
}

export async function revogarChaveApiAction(formData: FormData) {
  const urlKey = (formData.get("key") as string | null) ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!isAdmin(member)) redirect(comKey(urlKey));

  const id = (formData.get("id") as string | null) ?? "";
  if (!id) redirect(comKey(urlKey));

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("api_keys")
    .update({ revogada_at: new Date().toISOString() })
    .eq("id", id);
  if (error) logServerError("revogarChaveApiAction", error);

  revalidatePath("/admin/chaves-api");
  redirect(comKey(urlKey));
}
