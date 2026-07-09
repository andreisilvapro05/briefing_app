import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow, Pill } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { listBriefingTemplates } from "@/lib/briefing-templates-server";
import { createBriefingTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

interface SearchParams {
  key?: string;
}

export default async function BriefingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const templates = await listBriefingTemplates();

  return (
    <Shell tone="cream" sectionLabel="Admin · Briefings">
      <ContentFrame size="xl">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <AdminSidebar active="briefings" keyParam={keyParam} />
          <div className="flex-1 min-w-0 w-full">
            <header className="mb-6">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                  <Eyebrow>Painel interno</Eyebrow>
                  <h1 className="fysi-display text-3xl md:text-4xl mt-2">
                    Briefings
                  </h1>
                  <p className="text-fysi-muted text-sm mt-2">
                    Monte um briefing de perguntas uma vez e aplique a quantos
                    clientes quiser.
                  </p>
                </div>
                <Pill tone="muted">
                  {templates.length} briefing
                  {templates.length === 1 ? "" : "s"}
                </Pill>
              </div>
            </header>

            {/* Criar novo */}
            <form
              action={createBriefingTemplateAction}
              className="bg-white border border-fysi-line rounded-[16px] p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end"
            >
              {urlKey ? (
                <input type="hidden" name="key" value={urlKey} />
              ) : null}
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <label className="text-sm font-medium text-fysi-deep">
                  Novo briefing
                </label>
                <input
                  name="nome"
                  required
                  placeholder="Ex: Briefing — Landing Page"
                  className="border border-fysi-line rounded-[10px] px-3 py-2 bg-white text-sm text-fysi-deep"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 whitespace-nowrap"
              >
                Criar briefing
              </button>
            </form>

            {/* Lista */}
            {templates.length === 0 ? (
              <div className="bg-white border border-fysi-line rounded-[20px] p-8 text-center text-fysi-muted text-sm">
                Nenhum briefing criado ainda. Crie o primeiro acima — depois é
                só montar as perguntas e aplicar a um cliente.
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-3">
                {templates.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/briefings/${t.id}${keyParam}`}
                      className="block bg-white border border-fysi-line rounded-[16px] p-4 hover:border-fysi-mint-vivid transition h-full"
                    >
                      <p className="font-semibold text-fysi-deep">{t.nome}</p>
                      <p className="text-xs text-fysi-muted mt-1">
                        {t.perguntas.length} pergunta
                        {t.perguntas.length === 1 ? "" : "s"}
                      </p>
                      <span className="text-xs font-medium text-fysi-deep mt-3 inline-block">
                        Editar e aplicar →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ContentFrame>
    </Shell>
  );
}
