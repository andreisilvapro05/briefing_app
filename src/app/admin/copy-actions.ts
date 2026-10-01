"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember, hasFullAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
import {
  ativarLinkDaCopy,
  criarCopy,
  obterCopyDoCliente,
  revogarLinkDaCopy,
} from "@/lib/copy-server";

/**
 * A copy do cliente — criar o documento e controlar o link que o cliente
 * usa pra ler e responder.
 *
 * Quem mexe: acesso completo. A copy é texto de venda que vai ao cliente
 * com o nome da agência; ligar o link é um gesto externo, não de quem
 * está marcado numa tarefa do projeto.
 */

async function exigirAcessoCompleto(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) {
    redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }
  return { member, urlKey };
}

export async function criarCopyAction(formData: FormData): Promise<void> {
  await exigirAcessoCompleto(formData);
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  await criarCopy(clientId);
  revalidatePath(`/admin/${clientId}`);
}

export async function alternarLinkDaCopyAction(
  formData: FormData
): Promise<void> {
  await exigirAcessoCompleto(formData);
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const copy = await obterCopyDoCliente(clientId);
  if (!copy) return;

  if (copy.shareEnabled) await revogarLinkDaCopy(copy.id);
  else await ativarLinkDaCopy(copy.id);

  revalidatePath(`/admin/${clientId}`);
}

/**
 * Limpa a resposta do cliente pra abrir uma nova rodada.
 *
 * Depois de um ajuste, a copy mudou e a resposta antiga não vale mais —
 * sem isto a pílula ficaria dizendo "ajuste pedido" pra sempre, mesmo já
 * tendo sido atendido.
 */
export async function reabrirCopyAction(formData: FormData): Promise<void> {
  await exigirAcessoCompleto(formData);
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  const copy = await obterCopyDoCliente(clientId);
  if (!copy) return;

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("ei_documents")
    .update({
      aprovado_em: null,
      ajuste_pedido_em: null,
      aprovacao_comentario: null,
    })
    .eq("id", copy.id);
  if (error) logServerError("copy.reabrir", error);

  revalidatePath(`/admin/${clientId}`);
}
