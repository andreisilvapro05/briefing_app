"use server";

import { revalidatePath } from "next/cache";
import { clienteDoBriefingPorToken } from "@/lib/briefings-server";
import { marcarPeloCliente, normalizeStatus } from "@/lib/materiais-cliente-server";
import { createAdminNotification } from "@/lib/notifications";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";

/**
 * Ação do CLIENTE na lista "o que você precisa nos enviar", feita pelo link
 * público do briefing.
 *
 * Duas regras que valem mais que o resto deste arquivo:
 *
 * 1. Aqui NÃO existe login de membro. Quem autoriza é o token: ele é
 *    reconferido a cada chamada (revogado ou expirado não escreve nada) e o
 *    cliente que a escrita pode tocar é só o daquele token — nunca um id de
 *    cliente vindo do formulário.
 * 2. É Server Action (POST). Nunca uma rota GET: o <Link> do Next faz
 *    prefetch e marcaria material como enviado sem ninguém clicar.
 *
 * O cliente marcar "já enviei" não fecha o item: quem fecha é a equipe,
 * confirmando que chegou. "Eu mandei" e "chegou" são coisas diferentes, e é
 * justamente essa diferença que some no WhatsApp hoje.
 */
export async function marcarMaterialClienteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!token || !itemId) return;

  const alvo = await clienteDoBriefingPorToken(token);
  if (!alvo) return;

  const status = normalizeStatus(formData.get("status"));
  // Recado curto de propósito: é "mandei no WhatsApp" ou um link de pasta,
  // não um campo de texto livre pra qualquer coisa.
  const recadoBruto = String(formData.get("recado") ?? "").trim();
  const recado = status === "pendente" ? null : recadoBruto.slice(0, 500) || null;

  const item = await marcarPeloCliente(alvo.clientId, itemId, status, recado);

  if (item && status === "enviado") {
    const service = createSupabaseServiceRoleClient();
    // Mesmo marcador de atividade que o upload usa — é o que alimenta o
    // ponto de "parado/ativo" na lista de clientes.
    const { data: clienteRow, error } = await service
      .from("clients")
      .update({ last_client_activity_at: new Date().toISOString() })
      .eq("id", alvo.clientId)
      .select("nome, empresa")
      .maybeSingle();
    if (error) logServerError("materiais.atividade-cliente", error);

    const c = clienteRow as { nome: string | null; empresa: string | null } | null;
    // Janela de 30 min agrupa o lote: o cliente marca 5 itens seguidos e a
    // equipe recebe UM aviso, não cinco.
    await createAdminNotification({
      clientId: alvo.clientId,
      kind: "material.enviado",
      title: `Material marcado como enviado: ${c?.empresa || c?.nome || "cliente"}`,
      message: `O cliente marcou “${item.titulo}” como enviado no briefing`,
      dedupeMinutes: 30,
    });
  }

  revalidatePath(`/b/${token}`);
  revalidatePath(`/admin/${alvo.clientId}`);
  revalidatePath(`/admin/briefings/doc/${alvo.briefingId}`);
  revalidatePath("/admin/briefings");
}
