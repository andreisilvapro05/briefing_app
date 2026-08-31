"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentMember, isAdmin, type MemberRole } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { logServerError } from "@/lib/api-helpers";
import { TEAM_MEMBERS } from "@/lib/project-tasks";

const ROLES: MemberRole[] = ["admin", "avancado", "basico", "desenvolvedor"];
const TASK_VALUES = TEAM_MEMBERS.map((m) => m.value);

function keyParam(urlKey: string | null) {
  return urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
}

async function requireAdminOrRedirect(urlKey: string | null) {
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect(`/admin/login`);
  if (!isAdmin(member)) redirect(`/admin${keyParam(urlKey)}`);
  return member;
}

/** Cadastra um novo membro e dispara o magic link de primeiro acesso. */
export async function inviteMemberAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await requireAdminOrRedirect(urlKey);

  const Body = z.object({
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    role: z.enum(ROLES as [MemberRole, ...MemberRole[]]),
    taskValue: z.string().optional(),
  });
  const parsed = Body.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    taskValue: formData.get("taskValue"),
  });
  if (!parsed.success) return;

  const email = parsed.data.email.toLowerCase();
  const taskValue = TASK_VALUES.includes(parsed.data.taskValue ?? "")
    ? parsed.data.taskValue
    : null;
  const service = createSupabaseServiceRoleClient();

  const { data: created, error: insertErr } = await service
    .from("team_members")
    .insert({
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      task_value: taskValue,
    })
    .select("id")
    .single();

  if (insertErr) {
    logServerError("membros.invite", insertErr);
    revalidatePath("/admin/membros");
    return;
  }

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    revalidatePath("/admin/membros");
    return;
  }

  const { error: otpErr } = await service.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent("/admin")}`,
      shouldCreateUser: true,
    },
  });
  if (otpErr) {
    logServerError("membros.invite.otp", otpErr);
  } else if (created) {
    await service
      .from("team_members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", (created as { id: string }).id);
  }

  revalidatePath("/admin/membros");
}

/** Reenvia o convite (magic link) pra um membro que ainda não logou. */
export async function resendInviteAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await requireAdminOrRedirect(urlKey);

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("team_members")
    .select("email")
    .eq("id", memberId)
    .maybeSingle();
  const email = (data as { email: string } | null)?.email;
  if (!email) return;

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return;
  }

  await service.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent("/admin")}`,
      shouldCreateUser: true,
    },
  });
  await service
    .from("team_members")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", memberId);

  revalidatePath("/admin/membros");
}

/** Muda o papel de um membro. */
export async function setMemberRoleAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await requireAdminOrRedirect(urlKey);

  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!memberId || !ROLES.includes(role as MemberRole)) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("team_members").update({ role }).eq("id", memberId);

  revalidatePath("/admin/membros");
}

/**
 * Liga (ou desliga) o membro a um TEAM_MEMBERS (project-tasks.ts) — decide
 * quais clientes um membro "basico" enxerga (os que têm tarefa atribuída
 * a esse valor). Vazio = desliga o vínculo.
 */
export async function setMemberTaskValueAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await requireAdminOrRedirect(urlKey);

  const memberId = String(formData.get("memberId") ?? "");
  const taskValue = String(formData.get("taskValue") ?? "");
  if (!memberId) return;
  if (taskValue && !TASK_VALUES.includes(taskValue)) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("team_members")
    .update({ task_value: taskValue || null })
    .eq("id", memberId);

  revalidatePath("/admin/membros");
}

/** Ativa/desativa um membro (desativado perde acesso, sem apagar o registro). */
export async function toggleMemberActiveAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  await requireAdminOrRedirect(urlKey);

  const memberId = String(formData.get("memberId") ?? "");
  const active = formData.get("active") === "1";
  if (!memberId) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("team_members")
    .update({ active: !active })
    .eq("id", memberId);

  revalidatePath("/admin/membros");
}
