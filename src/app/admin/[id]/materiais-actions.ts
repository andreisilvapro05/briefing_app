"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isDeveloper,
  telaInicialDe,
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
  // Desenvolvedor: tem tarefa no cliente e passaria no escopo, mas escrever
  // aqui não é dele. A tela ele não vê; a Server Action é POST direto.
  if (isDeveloper(member)) {
    redirect(
      `${telaInicialDe(member)}${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`
    );
  }
  if (!hasFullAccess(member)) {
    const visible = await getVisibleClientIds(member);
    if (visible && !visible.has(clientId)) {
      redirect(`/admin${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
    }
  }
  return member;
}

/**
 * As sete ações devolvem resultado em vez de void: erro de banco virava
 * log e a tela anunciava sucesso. A lista é relida do banco no revalidate,
 * então o estado final não mentia — mas o "Salvo ✓" mentia, e quem some
 * com um item e vê "removido" espera que tenha removido.
 */
export type ResultadoMaterial = { ok: true } | { ok: false; erro: string };

const FALHOU: ResultadoMaterial = {
  ok: false,
  erro: "Não consegui salvar. Confira a conexão e tente de novo.",
};

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
export async function semearMateriaisAction(
  formData: FormData
): Promise<ResultadoMaterial> {
  const { clientId, docId } = campos(formData);
  if (!clientId) return { ok: false, erro: "Cliente não identificado." };
  await requireClientAccess(formData, clientId);
  if (!(await semearMateriaisPadrao(clientId))) return FALHOU;
  revalidar(clientId, docId);
  return { ok: true };
}

export async function adicionarMaterialAction(
  formData: FormData
): Promise<ResultadoMaterial> {
  const { clientId, docId } = campos(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  const instrucao = String(formData.get("instrucao") ?? "").trim();
  if (!clientId || !titulo) return { ok: false, erro: "Dê um nome ao item." };
  await requireClientAccess(formData, clientId);
  if (!(await criarMaterial(clientId, titulo, instrucao || null))) return FALHOU;
  revalidar(clientId, docId);
  return { ok: true };
}

export async function editarMaterialAction(
  formData: FormData
): Promise<ResultadoMaterial> {
  const { clientId, itemId, docId } = campos(formData);
  const titulo = String(formData.get("titulo") ?? "").trim();
  const instrucao = String(formData.get("instrucao") ?? "").trim();
  if (!clientId || !itemId || !titulo) return { ok: false, erro: "Dê um nome ao item." };
  await requireClientAccess(formData, clientId);
  if (!(await editarMaterial(clientId, itemId, titulo, instrucao || null))) return FALHOU;
  revalidar(clientId, docId);
  return { ok: true };
}

export async function removerMaterialAction(
  formData: FormData
): Promise<ResultadoMaterial> {
  const { clientId, itemId, docId } = campos(formData);
  if (!clientId || !itemId) return { ok: false, erro: "Item não identificado." };
  await requireClientAccess(formData, clientId);
  if (!(await removerMaterial(clientId, itemId))) return FALHOU;
  revalidar(clientId, docId);
  return { ok: true };
}

export async function moverMaterialAction(
  formData: FormData
): Promise<ResultadoMaterial> {
  const { clientId, itemId, docId } = campos(formData);
  const direcao = String(formData.get("direcao") ?? "");
  if (!clientId || !itemId || (direcao !== "up" && direcao !== "down")) {
    return { ok: false, erro: "Movimento inválido." };
  }
  await requireClientAccess(formData, clientId);
  if (!(await moverMaterial(clientId, itemId, direcao))) return FALHOU;
  revalidar(clientId, docId);
  return { ok: true };
}

/** Equipe marca pendente / enviado / não se aplica. */
export async function marcarMaterialAction(
  formData: FormData
): Promise<ResultadoMaterial> {
  const { clientId, itemId, docId } = campos(formData);
  if (!clientId || !itemId) return { ok: false, erro: "Item não identificado." };
  const member = await requireClientAccess(formData, clientId);
  const status = normalizeStatus(formData.get("status"));
  if (!(await marcarPelaEquipe(clientId, itemId, status, member.name))) return FALHOU;
  revalidar(clientId, docId);
  return { ok: true };
}

/** Equipe confirma que o que o cliente disse ter mandado realmente chegou. */
export async function conferirMaterialAction(
  formData: FormData
): Promise<ResultadoMaterial> {
  const { clientId, itemId, docId } = campos(formData);
  if (!clientId || !itemId) return { ok: false, erro: "Item não identificado." };
  const member = await requireClientAccess(formData, clientId);
  if (!(await conferirMaterial(clientId, itemId, member.name))) return FALHOU;
  revalidar(clientId, docId);
  return { ok: true };
}
