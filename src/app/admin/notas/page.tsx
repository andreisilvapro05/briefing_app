import { redirect } from "next/navigation";
import { getCurrentMember, hasFinanceAccess, isAdmin } from "@/lib/member";
import { listEIDocuments } from "@/lib/ei-documents-server";
import { AdminShell } from "@/components/admin/admin-shell";
import { SubmitButton } from "@/components/admin/submit-button";
import { criarNotaAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Índice dos documentos em branco. Sem nenhum, mostra o estado vazio com o
 * botão de criar — não redireciona pra id vazio, que é o loop que a versão
 * antiga do hub de briefings fazia.
 */
export default async function NotasIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const docs = await listEIDocuments("nota");
  if (docs[0]) redirect(`/admin/notas/${docs[0].id}${kp}`);

  return (
    <AdminShell
      active="notas"
      keyParam={kp}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Documentos
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Documento em branco pra escrever o que for — uma copy nova, a ata de
          uma reunião, um rascunho. Não precisa de cliente nem de modelo.
        </p>
      </header>

      <form
        action={criarNotaAction}
        className="rounded-[20px] border border-dashed border-fysi-line bg-white px-6 py-10 text-center"
      >
        {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
        <p className="text-sm text-fysi-muted mb-4">Nenhum documento ainda.</p>
        <SubmitButton>+ Novo documento em branco</SubmitButton>
      </form>
    </AdminShell>
  );
}
