"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentMember,
  getVisibleClientIds,
  hasFullAccess,
  hasTaskScopedRole,
  isDeveloper,
  telaInicialDe,
} from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/api-helpers";
import {
  normalizarAcessos,
  normalizarBotoes,
  normalizarPixels,
} from "@/lib/ficha-implementacao";
import { salvarFicha } from "@/lib/ficha-implementacao-server";
import { TASK_STATUS_GROUP, TASK_STATUS_VALUES, type TaskStatus } from "@/lib/project-tasks";

/**
 * Escrita da ficha de implementação (Figma, links de botão, pixel, acessos).
 *
 * Quem escreve: a EQUIPE. O papel "desenvolvedor" é só-leitura aqui de
 * propósito — ver a justificativa em src/app/admin/desenvolvimento/page.tsx.
 * A única escrita dele é `atualizarMinhaTarefaAction` (no fim deste
 * arquivo): status e observações da tarefa que é dele.
 */

/** Limite por campo — evita um paste de 2 MB virar linha no banco. */
const MAX_TEXTO = 2000;
/** Uma página de verdade não tem 60 botões; o teto é contra abuso, não uso. */
const MAX_ITENS = 60;

function cortar(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_TEXTO) : "";
}

/**
 * Autoriza a escrita e devolve o cliente dono do documento.
 *
 * O clientId NÃO vem do formulário: é lido do próprio documento no banco.
 * Confiar no campo enviado deixaria qualquer pessoa logada escrever em
 * documento de cliente fora do escopo dela, só trocando o valor do input.
 */
async function autorizarEscrita(
  docId: string,
  urlKey: string | null
): Promise<{ clientId: string } | null> {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Desenvolvedor lê a ficha, não escreve.
  if (isDeveloper(member)) return null;
  if (!docId) return null;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("ei_documents")
    .select("client_id")
    .eq("id", docId)
    .maybeSingle();
  const clientId = (data as { client_id: string | null } | null)?.client_id;
  if (!clientId) return null;

  if (!hasFullAccess(member)) {
    const visiveis = await getVisibleClientIds(member);
    if (visiveis && !visiveis.has(clientId)) return null;
  }
  return { clientId };
}

/**
 * Salva a ficha inteira de uma vez. Os três blocos de lista chegam como
 * JSON num input escondido: o editor é uma lista que cresce e encolhe no
 * navegador, e mandar `botoes[0][rotulo]` no FormData reinventaria o
 * serializador por nada.
 */
export type ResultadoFicha = { ok: true } | { ok: false; erro: string };

export async function salvarFichaAction(
  formData: FormData
): Promise<ResultadoFicha> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const docId = String(formData.get("docId") ?? "").trim();
  const voltarPara = String(formData.get("voltarPara") ?? "").trim();

  const ok = await autorizarEscrita(docId, urlKey);
  if (!ok) {
    const member = await getCurrentMember({ urlKey });
    redirect(
      `${member ? telaInicialDe(member) : "/admin"}${
        urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""
      }`
    );
  }

  const lista = (campo: string): unknown => {
    const cru = String(formData.get(campo) ?? "");
    if (!cru) return [];
    try {
      const v = JSON.parse(cru);
      return Array.isArray(v) ? v.slice(0, MAX_ITENS) : [];
    } catch {
      // JSON quebrado não pode APAGAR o que estava salvo: devolver []
      // gravaria uma lista vazia por cima da boa.
      return null;
    }
  };

  const botoesCru = lista("botoes");
  const pixelsCru = lista("pixels");
  const acessosCru = lista("acessos");

  // `salvarFicha` devolve false quando o banco recusa. Antes o resultado
  // era ignorado e o botão dizia "Salvo ✓" com os acessos só no navegador
  // — quem fechasse a aba perdia tudo. Achado da revisão de 22/09.
  const gravou = await salvarFicha(docId, {
    figmaUrl: cortar(formData.get("figmaUrl")) || null,
    ...(botoesCru === null
      ? {}
      : {
          botoes: normalizarBotoes(botoesCru).map((b) => ({
            rotulo: cortar(b.rotulo),
            destino: cortar(b.destino),
          })),
        }),
    ...(pixelsCru === null
      ? {}
      : {
          pixels: normalizarPixels(pixelsCru).map((p) => ({
            tipo: cortar(p.tipo),
            identificador: cortar(p.identificador),
            observacao: cortar(p.observacao),
          })),
        }),
    ...(acessosCru === null
      ? {}
      : {
          acessos: normalizarAcessos(acessosCru).map((c) => ({
            contexto: cortar(c.contexto) || "Acessos",
            rotulo: cortar(c.rotulo),
            valor: cortar(c.valor),
          })),
        }),
  });

  if (!gravou) {
    return { ok: false, erro: "Não consegui salvar a ficha. Confira a conexão e tente de novo." };
  }

  revalidatePath("/admin/desenvolvimento");
  if (voltarPara.startsWith("/admin/")) revalidatePath(voltarPara);
  revalidatePath(`/admin/estruturas-iniciais/${docId}`);
  return { ok: true };
}

/**
 * Status e observações da PRÓPRIA tarefa — o único lugar em que quem só
 * implementa escreve.
 *
 * Não reaproveita `updateProjectTaskAction` (admin/[id]/actions.ts) de
 * propósito: a guarda de lá (`canEditTask`) libera todo papel que não seja
 * literalmente "basico", então um papel novo entra por ela como se tivesse
 * acesso total. Aqui a regra é dita pelo que o papel É (hasTaskScopedRole),
 * não pelo nome de um papel específico.
 */
export type ResultadoMinhaTarefa = { ok: true } | { ok: false; erro: string };

export async function atualizarMinhaTarefaAction(
  formData: FormData
): Promise<ResultadoMinhaTarefa> {
  const urlKey = String(formData.get("key") ?? "") || null;
  const taskId = String(formData.get("taskId") ?? "").trim();
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  if (!taskId) return { ok: false, erro: "Tarefa não identificada." };

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("project_tasks")
    .select("client_id, responsavel")
    .eq("id", taskId)
    .maybeSingle();
  const tarefa = data as {
    client_id: string | null;
    responsavel: string | null;
  } | null;
  if (!tarefa) return { ok: false, erro: "Tarefa não encontrada." };

  // Papel restrito por tarefa (basico/desenvolvedor): só a tarefa dele, e só
  // se o cliente estiver no escopo. As duas condições, não uma ou outra —
  // `responsavel` é um texto ("daniel") que o sync do ClickUp também grava,
  // então sozinho ele não é um dono de dados confiável.
  const semAcesso = { ok: false as const, erro: "Essa tarefa não é sua." };
  if (hasTaskScopedRole(member)) {
    if (!member.taskValue || tarefa.responsavel !== member.taskValue) return semAcesso;
    const visiveis = await getVisibleClientIds(member);
    if (visiveis && (!tarefa.client_id || !visiveis.has(tarefa.client_id))) {
      return semAcesso;
    }
  } else if (!hasFullAccess(member)) {
    return semAcesso;
  }

  const update: Record<string, unknown> = {};
  if (formData.has("status")) {
    const status = String(formData.get("status") ?? "");
    if (!TASK_STATUS_VALUES.includes(status as TaskStatus)) {
      return { ok: false, erro: "Status inválido." };
    }
    update.status = status;
    // Mesma regra de updateProjectTaskAction: fechar marca concluida_em,
    // reabrir limpa. Sem isso a tarefa concluída daqui ficava sem data de
    // conclusão — e o resto do app (Meu Trabalho, relatórios) conta por
    // ela. Achado da revisão de 22/09.
    update.concluida_em =
      TASK_STATUS_GROUP[status as TaskStatus] === "fechado"
        ? new Date().toISOString()
        : null;
  }
  if (formData.has("observacoes")) {
    update.observacoes = cortar(formData.get("observacoes")) || null;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await service
    .from("project_tasks")
    .update(update)
    .eq("id", taskId);
  if (error) {
    logServerError("desenvolvimento.atualizarTarefa", error);
    return { ok: false, erro: "Não consegui salvar. Confira a conexão e tente de novo." };
  }

  revalidatePath(`/admin/desenvolvimento/${taskId}`);
  revalidatePath("/admin/desenvolvimento");
  return { ok: true };
}
