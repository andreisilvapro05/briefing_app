import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { errorResponse, logServerError } from "@/lib/api-helpers";
import { getServerEnv } from "@/lib/env";
import { createAdminNotification } from "@/lib/notifications";
import {
  listarMateriais,
  marcarPeloCliente,
  normalizeStatus,
} from "@/lib/materiais-cliente-server";

/**
 * "O que ainda falta você nos enviar", do lado do CLIENTE, no painel dele.
 *
 * Pedido da Karine (26/09): "hoje eu anoto sempre no documento do Drive,
 * mas seria importante isso estar no próprio briefing dentro do app".
 *
 * A lista já existia (client_materials, desde 22/09) e tinha ZERO uso. O
 * mapeamento de 26/09 achou a causa: ela só aparecia pro cliente dentro de
 * /b/[token], o link público do briefing — e só 1 dos 35 briefings tinha
 * esse link ligado. Ou seja, mesmo que a equipe montasse a lista, o cliente
 * não teria como vê-la. A porta que ele usa de verdade é /dashboard.
 *
 * Autorização: o mesmo modelo de /api/me/stage — o clientId (UUID) que ele
 * guarda no navegador. Não é login; é o desenho já adotado nesta parte do
 * app, e o que trafega aqui é o que ele mesmo precisa mandar. Marcar
 * "já enviei" é DECLARAÇÃO do cliente, nunca confirmação de recebimento:
 * quem confirma é a equipe, no admin.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Listar = z.object({ clientId: z.string().uuid() });

const Marcar = z.object({
  clientId: z.string().uuid(),
  itemId: z.string().uuid(),
  status: z.string(),
  recado: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return NextResponse.json({ itens: [] });
  }

  let parsed: z.infer<typeof Listar>;
  try {
    parsed = Listar.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  try {
    const itens = await listarMateriais(parsed.clientId);
    // Só o que o cliente precisa ver: título, instrução e em que pé está.
    return NextResponse.json({
      itens: itens.map((i) => ({
        id: i.id,
        titulo: i.titulo,
        instrucao: i.instrucao,
        status: i.status,
        recadoDoCliente: i.recadoDoCliente ?? null,
      })),
    });
  } catch (err) {
    logServerError("me.materiais.listar", err);
    return errorResponse("load-failed", 500, err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    getServerEnv();
  } catch {
    return errorResponse("server-not-configured", 503);
  }

  let parsed: z.infer<typeof Marcar>;
  try {
    parsed = Marcar.parse(await request.json());
  } catch (err) {
    return errorResponse("payload-invalid", 400, err);
  }

  const status = normalizeStatus(parsed.status);
  // "Não se aplica" é decisão da equipe, não do cliente — ele só diz se
  // mandou ou ainda não.
  if (status === "nao_se_aplica") {
    return errorResponse("status-nao-permitido", 400);
  }

  try {
    const item = await marcarPeloCliente(
      parsed.clientId,
      parsed.itemId,
      status,
      status === "pendente" ? null : (parsed.recado ?? null)
    );
    if (!item) return errorResponse("item-nao-encontrado", 404);

    if (status === "enviado") {
      const service = createSupabaseServiceRoleClient();
      const { data: cliente, error } = await service
        .from("clients")
        .update({ last_client_activity_at: new Date().toISOString() })
        .eq("id", parsed.clientId)
        .select("nome, empresa")
        .maybeSingle();
      if (error) logServerError("me.materiais.atividade", error);

      const c = cliente as { nome: string | null; empresa: string | null } | null;
      // Janela de 30 min agrupa o lote: o cliente marca cinco itens
      // seguidos e a equipe recebe UM aviso, não cinco. Mesmo critério da
      // ação equivalente em /b/[token].
      await createAdminNotification({
        clientId: parsed.clientId,
        kind: "material.enviado",
        title: `Material marcado como enviado: ${c?.empresa || c?.nome || "cliente"}`,
        message: `O cliente marcou “${item.titulo}” como enviado no painel`,
        dedupeMinutes: 30,
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    logServerError("me.materiais.marcar", err);
    return errorResponse("save-failed", 500, err);
  }
}
