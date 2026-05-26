import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ClientHydrator } from "@/components/client-hydrator";
import type { ProjectType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PainelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("id, nome, email, empresa, whatsapp, project_type")
    .eq("magic_slug", slug)
    .maybeSingle();

  if (!data) notFound();

  return (
    <ClientHydrator
      cliente={{
        id: data.id,
        nome: data.nome,
        whatsapp: data.whatsapp,
        email: data.email || undefined,
        empresa: data.empresa || undefined,
        projectType: (data.project_type as ProjectType | null) ?? undefined,
      }}
    />
  );
}
