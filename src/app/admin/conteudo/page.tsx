import { redirect } from "next/navigation";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
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
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const columns = await listContentBoard();

  return (
    <AdminShell
      active="conteudo"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-4">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Conteúdo
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Quadro de produção de conteúdo da Fysi. Crie colunas do seu fluxo e
          mova os cartões conforme avançam.
        </p>
      </header>
      <ContentBoard initialColumns={columns} urlKey={urlKey ?? undefined} />
    </AdminShell>
  );
}
