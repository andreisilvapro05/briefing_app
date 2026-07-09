import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { BriefingTemplateBuilder } from "@/components/admin/briefing-template-builder";
import { getBriefingTemplate } from "@/lib/briefing-templates-server";
import { deleteBriefingTemplateAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BriefingTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  const urlKey = key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const template = await getBriefingTemplate(id);
  if (!template) redirect(`/admin/briefings${keyParam}`);

  // Clientes pra o dropdown "Aplicar a um cliente".
  const service = createSupabaseServiceRoleClient();
  const { data: clientsData } = await service
    .from("clients")
    .select("id, nome, empresa")
    .order("nome", { ascending: true });
  const clients = (clientsData as
    | { id: string; nome: string; empresa: string | null }[]
    | null) ?? [];

  return (
    <Shell tone="cream" sectionLabel="Admin · Briefings">
      <ContentFrame size="xl">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <AdminSidebar active="briefings" keyParam={keyParam} />
          <div className="flex-1 min-w-0 w-full">
            <header className="mb-6">
              <Link
                href={`/admin/briefings${keyParam}`}
                className="text-xs text-fysi-muted hover:text-fysi-deep"
              >
                ← Todos os briefings
              </Link>
              <div className="mt-2">
                <Eyebrow>Montar briefing</Eyebrow>
                <h1 className="fysi-display text-3xl md:text-4xl mt-2">
                  {template!.nome}
                </h1>
              </div>
            </header>

            <BriefingTemplateBuilder
              templateId={template!.id}
              urlKey={urlKey ?? undefined}
              initialNome={template!.nome}
              initialPerguntas={template!.perguntas}
              clients={clients}
            />

            {/* Excluir */}
            <form
              action={deleteBriefingTemplateAction}
              className="mt-8 pt-6 border-t border-fysi-line"
            >
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <input type="hidden" name="id" value={template!.id} />
              <button
                type="submit"
                className="text-xs text-red-700 hover:underline"
              >
                Excluir este briefing
              </button>
            </form>
          </div>
        </div>
      </ContentFrame>
    </Shell>
  );
}
