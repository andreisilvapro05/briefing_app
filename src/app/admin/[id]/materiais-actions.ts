"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
  type Member,
} from "@/lib/member";
import {
  conferirMaterial,
  criarMaterial,
  editarMaterial,
  marcarPelaEquipe,
  moverMaterial,
  normalizeStatus,
  removerMaterial,
  semearMateriaisPadrao,
} from "@/lib/materiais-cliente-server";

/**
 * Ações da EQUIPE sobre "o que o cliente precisa enviar".
 *
 * Arquivo separado do `actions.ts` da ficha (que já passa de 1.800 linhas) —
 * mesma ideia de `briefings/actions.ts`: é módulo, não rota.
 *
 * Tudo é Server Action (POST). Nada disso pode virar rota GET: o <Link> do
 * Next faz prefetch e marcaria material como enviado sozinho, só de alguém
 * passar o mouse na lista.
 */

function keyParamOf(formData: FormData): string | null {
  return String(formData.get("key") ?? "") || null;
}

/**
 * Mesma regra das outras escritas operacionais da ficha: "basico" (designer)
 * só mexe em cliente em que está marcado — e isso é conferido aqui no
 * servidor, não só escondido da tela.
 */
async function requireClientAccess(
  formData: FormData,
  clientId: string
): Promise<Member> {
  const urlKey = keyParamOf(formData);
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!hasFullAccess(member)) {
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(clientId)) {
      redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
    }
  }
  return member;
}

/** Revalida as duas telas que mostram a lista + o hub que mostra o resumo. */
function revalidar(clientId: string, docId: string | null) {
  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin/briefings");
  if (docId) revalidatePath(`/admin/briefings/doc/${docId}`);
}

function campos(formData: FormData) {
  return {
    clientId: String(formData.get("clientId") ?? ""),
    itemId: String(formData.get("itemId") ?? ""),
    docId: String(formData.get("docId") ?? "") || null,
  };
}

/** Cria a lista padrão sugerida (8 itens) pra não começar do zero. */
export async function semearMateriaisAction(formData: FormData) {
  const { clientId, docId } = campos(formData);
  if (!clientId) return;
  await requireClientAccess(formData, clientId);
  await semearMateriaisPadrao(clientId);
  revalidar(clientId, docId);
}

export async function adicionarMaterialAction(formData: FormData) {
  const { clientId, docId } = campos(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  const instrucao = String(formData.get("instrucao") ?? "").trim();
  if (!clientId || !titulo) return;
  await requireClientAccess(formData, clientId);
  await criarMaterial(clientId, titulo, instrucao || null);
  revalidar(clientId, docId);
}

export async function editarMaterialAction(formData: FormData) {
  const { clientId, itemId, docId } = campos(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  const instrucao = String(formData.get("instrucao") ?? "").trim();
  if (!clientId || !itemId || !titulo) return;
  await requireClientAccess(formData, clientId);
  await editarMaterial(clientId, itemId, titulo, instrucao || null);
  revalidar(clientId, docId);
}

export async function removerMaterialAction(formData: FormData) {
  const { clientId, itemId, docId } = campos(formData);
  if (!clientId || !itemId) return;
  await requireClientAccess(formData, clientId);
  await removerMaterial(clientId, itemId);
  revalidar(clientId, docId);
}

export async function moverMaterialAction(formData: FormData) {
  const { clientId, itemId, docId } = campos(formData);
  const direcao = String(formData.get("direcao") ?? "");
  if (!clientId || !itemId || (direcao !== "up" && direcao !== "down")) return;
  await requireClientAccess(formData, clientId);
  await moverMaterial(clientId, itemId, direcao);
  revalidar(clientId, docId);
}

/** Equipe marca pendente / enviado / não se aplica. */
export async function marcarMaterialAction(formData: FormData) {
  const { clientId, itemId, docId } = campos(formData);
  if (!clientId || !itemId) return;
  const member = await requireClientAccess(formData, clientId);
  const status = normalizeStatus(formData.get("status"));
  await marcarPelaEquipe(clientId, itemId, status, member.name);
  revalidar(clientId, docId);
}

/** Equipe confirma que o que o cliente disse ter mandado realmente chegou. */
export async function conferirMaterialAction(formData: FormData) {
  const { clientId, itemId, docId } = campos(formData);
  if (!clientId || !itemId) return;
  const member = await requireClientAccess(formData, clientId);
  await conferirMaterial(clientId, itemId, member.name);
  revalidar(clientId, docId);
}
