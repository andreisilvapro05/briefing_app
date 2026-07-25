import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow } from "@/components/ui/pill";
import { getAdminUser } from "@/lib/admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ContentBoard } from "@/components/admin/content-board";
import { listContentBoard } from "@/lib/content-board-server";

export const dynamic = "force-dynamic";

export default async function ConteudoPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const urlKey = key ?? null;
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const columns = await listContentBoard();

  return (
    <Shell
      tone="cream"
      homeHref={`/admin${keyParam}`}
      homeLabel="Voltar ao painel"
      sectionLabel="Admin · Conteúdo"
    >
      <ContentFrame size="xl">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <AdminSidebar active="conteudo" keyParam={keyParam} />
          <div className="flex-1 min-w-0 w-full">
            <header className="mb-6">
              <Eyebrow>Produção interna</Eyebrow>
              <h1 className="fysi-display text-3xl md:text-4xl mt-2">
                Conteúdo
              </h1>
              <p className="text-fysi-muted text-sm mt-2">
                Quadro de produção de conteúdo da Fysi. Crie colunas do seu
                fluxo e mova os cartões conforme avançam.{" "}
                <Link
                  href="/api/auth/admin-logout"
                  className="underline hover:text-fysi-deep"
                >
                  sair
                </Link>
              </p>
            </header>

            <ContentBoard
              initialColumns={columns}
              urlKey={urlKey ?? undefined}
            />
          </div>
        </div>
      </ContentFrame>
    </Shell>
  );
}
