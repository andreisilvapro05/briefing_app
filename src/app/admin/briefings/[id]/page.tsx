import { redirect } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/pill";
import { SubmitTextButton } from "@/components/admin/submit-button";
import { getCurrentMember, hasFullAccess, hasFinanceAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
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
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");
  // Template de briefing é configuração da agência (vale pra todos os
  // clientes) — só quem tem visão completa edita.
  if (!hasFullAccess(member)) {
    redirect(`/admin/briefings${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);
  }

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
    <AdminShell
      active="briefings"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
              <Link
                href={`/admin/briefings${keyParam}`}
                className="text-xs text-fysi-muted hover:text-fysi-deep"
              >
                ← Todos os briefings
              </Link>
              <div className="mt-2">
                <Eyebrow>Montar briefing</Eyebrow>
                <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep mt-1">
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
              <SubmitTextButton
                danger
                confirm="Excluir este briefing? As perguntas dele somem pra todo mundo."
                pendingLabel="Excluindo…"
              >
                Excluir este briefing
              </SubmitTextButton>
            </form>
    </AdminShell>
  );
}
