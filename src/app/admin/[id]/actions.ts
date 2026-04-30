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
  const user = await getAdminUser();
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
  const user = await getAdminUser();
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
