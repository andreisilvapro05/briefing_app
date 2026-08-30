import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getTemplateDocument } from "@/lib/ei-documents-server";

export const dynamic = "force-dynamic";

export default async function EstruturasIniciaisIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const template = await getTemplateDocument();
  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  redirect(`/admin/estruturas-iniciais/${template?.id ?? ""}${kp}`);
}
