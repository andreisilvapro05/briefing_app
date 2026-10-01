"use server";

import { revalidatePath } from "next/cache";
import { responderCopy } from "@/lib/copy-server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";

export interface RespostaState {
  ok?: boolean;
  erro?: string;
}

/**
 * O cliente aprova a copy, ou pede ajuste, pelo link público.
 *
 * Sem login: quem tem o token é o cliente. A autorização É o token, e ele
 * é revalidado no servidor (`responderCopy`) em vez de confiar no id que
 * veio no formulário — senão quem descobrisse um id escreveria aprovação
 * em qualquer copy do sistema.
 */
export async function responderCopyAction(
  _anterior: RespostaState,
  formData: FormData
): Promise<RespostaState> {
  const token = String(formData.get("token") ?? "");
  const resposta = String(formData.get("resposta") ?? "");
  const comentario = String(formData.get("comentario") ?? "");

  if (resposta !== "aprovar" && resposta !== "ajuste") {
    return { erro: "Escolha aprovar ou pedir ajuste." };
  }
  // Pedir ajuste sem dizer o quê deixa a equipe adivinhando.
  if (resposta === "ajuste" && comentario.trim().length < 3) {
    return { erro: "Escreva o que precisa mudar." };
  }

  const r = await responderCopy(token, resposta, comentario);
  if (!r.ok) return { erro: "Este link não está mais ativo." };

  /**
   * Avisa a equipe. Sem isto a resposta do cliente ficaria esperando
   * alguém abrir a ficha dele por acaso — que é exatamente o problema que
   * levar a copy pro app deveria resolver.
   */
  try {
    const service = createSupabaseServiceRoleClient();
    await service.from("admin_notifications").insert({
      client_id: r.clientId,
      kind: resposta === "aprovar" ? "copy_aprovada" : "copy_ajuste",
      title:
        resposta === "aprovar"
          ? "Copy aprovada pelo cliente"
          : "Cliente pediu ajuste na copy",
      message: comentario.trim().slice(0, 500) || null,
    });
  } catch (err) {
    // O aviso falhar não pode derrubar a resposta: ela já está gravada.
    logServerError("copy.notificacao", err);
  }

  revalidatePath(`/copy/${token}`);
  return { ok: true };
}
