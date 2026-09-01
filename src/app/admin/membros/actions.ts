"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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

/**
 * Gera um LINK de acesso direto pro membro (sem depender do e-mail) — o
 * admin copia e manda por WhatsApp. Usa admin.generateLink (não envia
 * e-mail) + a rota /auth/confirm (verifyOtp, sem PKCE, funciona em
 * qualquer aparelho). Contorna o problema do Resend em modo de teste que
 * não entrega e-mail pra ninguém além da dona da conta.
 */
export async function generateMemberAccessLinkAction(
  memberId: string,
  urlKey: string | null
): Promise<{ link: string } | { error: string }> {
  const admin = await getCurrentMember({ urlKey });
  if (!admin) return { error: "unauthenticated" };
  if (!isAdmin(admin)) return { error: "forbidden" };

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return { error: "server-not-configured" };
  }

  // Origem do link = o domínio em que o admin está navegando (via headers do
  // request), não o env.appUrl — que na Vercel aponta pro domínio *.vercel.app
  // e faria a pessoa logar no domínio errado (cookie não vale no oficial).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const appOrigin = host ? `${proto}://${host}` : env.appUrl;

  const service = createSupabaseServiceRoleClient();
  const { data: member } = await service
    .from("team_members")
    .select("email")
    .eq("id", memberId)
    .maybeSingle();
  const email = (member as { email: string } | null)?.email?.toLowerCase();
  if (!email) return { error: "member-not-found" };

  // Garante que o usuário de auth existe (generateLink magiclink precisa
  // dele). Se já existe, o erro é ignorado.
  try {
    await service.auth.admin.createUser({ email, email_confirm: true });
  } catch {
    // já existe — segue
  }

  try {
    const { data, error } = await service.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !data?.properties?.hashed_token) {
      logServerError("membros.access-link", error);
      return { error: "generate-failed" };
    }
    const { hashed_token, verification_type } = data.properties;
    const link = `${appOrigin}/auth/confirm?token_hash=${encodeURIComponent(
      hashed_token
    )}&type=${encodeURIComponent(verification_type)}&next=${encodeURIComponent("/admin")}`;
    return { link };
  } catch (err) {
    logServerError("membros.access-link.throw", err);
    return { error: "generate-failed" };
  }
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

  // signInWithOtp chama a API de auth (que por sua vez dispara e-mail via
  // Resend/SMTP) — uma falha de rede aí não pode derrubar a action inteira
  // (o membro já foi criado; sem isso o admin cai na tela de erro genérica
  // do Next mesmo com o cadastro tendo funcionado).
  try {
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
  } catch (err) {
    logServerError("membros.invite.otp.throw", err);
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

  try {
    const { error: otpErr } = await service.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent("/admin")}`,
        shouldCreateUser: true,
      },
    });
    if (otpErr) {
      logServerError("membros.resend.otp", otpErr);
    } else {
      await service
        .from("team_members")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", memberId);
    }
  } catch (err) {
    logServerError("membros.resend.otp.throw", err);
  }

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
