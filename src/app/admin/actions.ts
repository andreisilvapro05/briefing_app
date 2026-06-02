"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Marca uma notificação como lida (dispensar do banner do /admin).
 */
export async function dismissNotificationAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return;

  const service = createSupabaseServiceRoleClient();
  await service
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  revalidatePath("/admin");
}

/**
 * Marca TODAS as notificações não lidas como lidas. Útil pra "marcar tudo
 * como lido" quando admin já viu o banner.
 */
export async function dismissAllNotificationsAction(formData: FormData) {
  const urlKey = String(formData.get("key") ?? "") || null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const service = createSupabaseServiceRoleClient();
  await service
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  revalidatePath("/admin");
}
