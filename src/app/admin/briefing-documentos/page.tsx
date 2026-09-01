import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/member";
import { getTemplateDocument } from "@/lib/ei-documents-server";

export const dynamic = "force-dynamic";

export default async function BriefingDocumentosIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const template = await getTemplateDocument("briefing");
  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  redirect(`/admin/briefing-documentos/${template?.id ?? ""}${kp}`);
}
