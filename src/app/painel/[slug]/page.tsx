import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ClientHydrator } from "@/components/client-hydrator";
import type { ProjectType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PainelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ir?: string }>;
}) {
  const { slug } = await params;
  const { ir } = await searchParams;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("id, nome, email, empresa, whatsapp, project_type")
    .eq("magic_slug", slug)
    .maybeSingle();

  if (!data) notFound();

  // ?ir=briefing → leva o cliente direto pro briefing (link "vá direto pro
  // briefing"). Sem isso, cai no dashboard como antes.
  const destino = ir === "briefing" ? "/briefing" : "/dashboard";

  return (
    <ClientHydrator
      destino={destino}
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
