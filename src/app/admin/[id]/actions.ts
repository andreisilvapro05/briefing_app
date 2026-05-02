"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createClickUpBriefingTask } from "@/lib/clickup";
import { htmlMagicLink, sendEmail } from "@/lib/email";
import { getServerEnv } from "@/lib/env";

/**
 * Reenviar magic link para o cliente (acionado pelo admin).
 */
export async function resendClientLinkAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const email = String(formData.get("email") ?? "");
  if (!email) return;

  const env = getServerEnv();
  const service = createSupabaseServiceRoleClient();

  await service.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  });

  // Também enviamos um e-mail "humano" via Resend (Supabase já manda o magic-link
  // automático; este é um aviso complementar).
  try {
    await sendEmail({
      to: email,
      subject: "Seu link de acesso · Fysi Lab",
      html: htmlMagicLink({
        nome: "",
        link: `${env.appUrl}/entrar`,
      }),
    });
  } catch {
    // Best-effort
  }
}

/**
 * Cria a tarefa no ClickUp para o cliente.
 * Útil quando o auto-envio na conclusão falhou ou ainda não rodou.
 */
export async function sendToClickupAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();
  const [{ data: client }, { data: responses }] = await Promise.all([
    service.from("clients").select("*").eq("id", clientId).maybeSingle(),
    service
      .from("briefing_responses")
      .select("field_id, value")
      .eq("client_id", clientId),
  ]);

  if (!client) return;

  const responsesMap: Record<string, unknown> = {};
  for (const r of (responses ?? []) as { field_id: string; value: unknown }[]) {
    responsesMap[r.field_id] = r.value;
  }

  const env = getServerEnv();
  const result = await createClickUpBriefingTask({
    cliente: {
      id: client.id,
      nome: client.nome,
      email: client.email,
      empresa: client.empresa,
      whatsapp: client.whatsapp,
      projectType: client.project_type,
      createdAt: client.created_at,
      updatedAt: client.updated_at,
    },
    responses: responsesMap,
    publicLinkParaPainelAdmin: `${env.appUrl}/admin/${client.id}`,
  });

  if (result.taskId) {
    await service
      .from("clients")
      .update({ clickup_task_id: result.taskId })
      .eq("id", clientId);
  }

  revalidatePath(`/admin/${clientId}`);
}


/**
 * Avança ou retrocede o stage do projeto. Aceita 'next', 'prev' ou número absoluto.
 */
export async function setStageAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const targetStr = String(formData.get("target") ?? "");

  if (!clientId) return;

  const service = createSupabaseServiceRoleClient();
  const { data: client } = await service
    .from("clients")
    .select("current_stage_index, project_type")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return;

  // Calcula stage máximo a partir do project_type. Sem chamada cara — números fixos.
  // landing-sem-copy = 5 stages (índices 0–4); demais = 6 stages (0–5).
  const maxIndex = client.project_type === "landing-sem-copy" ? 4 : 5;

  let next = client.current_stage_index ?? 0;
  if (direction === "next") next = Math.min(maxIndex, next + 1);
  else if (direction === "prev") next = Math.max(0, next - 1);
  else if (targetStr) {
    const target = parseInt(targetStr, 10);
    if (!Number.isNaN(target)) next = Math.max(0, Math.min(maxIndex, target));
  }

  if (next === (client.current_stage_index ?? 0)) {
    revalidatePath(`/admin/${clientId}`);
    return;
  }

  await service
    .from("clients")
    .update({ current_stage_index: next })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin");
}

/**
 * Atualiza o status geral do cliente (em-andamento/concluido/abandonado).
 */
export async function setClientStatusAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const clientId = String(formData.get("clientId") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["nao-iniciado", "em-andamento", "concluido", "abandonado"];
  if (!clientId || !allowed.includes(status)) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("clients")
    .update({ status })
    .eq("id", clientId);

  revalidatePath(`/admin/${clientId}`);
  revalidatePath("/admin");
}
