import { redirect } from "next/navigation";
import { getCurrentMember, hasFinanceAccess, isAdmin } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { EIDocumentSidebar } from "@/components/admin/ei-document-sidebar";
import { EIView } from "@/components/admin/ei-view";
import { NotaTitulo } from "@/components/admin/nota-titulo";
import { DeleteButton } from "@/components/admin/delete-button";
import { criarNotaAction, apagarNotaAction } from "@/app/admin/notas/actions";
import { listEIDocuments, getEIDocument } from "@/lib/ei-documents-server";

export const dynamic = "force-dynamic";

/**
 * Documento em branco — mesmo editor de blocos dos outros dois hubs, sem
 * Modelo e sem cliente. Pedido da Karine (27/09): "uma parte que eu possa
 * criar um documento limpo pra anotar coisas, por exemplo pra criar uma
 * copy nova".
 */
export default async function NotaPage({
  params,
  searchParams,
}: {
  params: Promise<{ docId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { docId } = await params;
  const sp = await searchParams;
  const urlKey = sp.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const [docs, doc] = await Promise.all([
    listEIDocuments("nota"),
    getEIDocument(docId),
  ]);

  // Id de outro tipo na URL não abre aqui: os três hubs dividem a tabela.
  if (!doc || doc.kind !== "nota") redirect(`/admin/notas${kp}`);

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
      <div className="flex -mx-4 md:-mx-6 lg:-mx-8 -my-6 h-[calc(100vh-3.5rem)]">
        <EIDocumentSidebar
          docs={docs}
          activeId={docId}
          urlKey={urlKey}
          clientsWithoutDoc={[]}
          criarDireto
          basePath="/admin/notas"
          createAction={criarNotaAction}
          createLabel="+ Novo documento em branco"
          subTabs={[
            { label: "Respostas", href: `/admin/briefings${kp}`, active: false },
            {
              label: "Documentos",
              href: `/admin/briefing-documentos${kp}`,
              active: false,
            },
            { label: "Em branco", href: `/admin/notas${kp}`, active: true },
          ]}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <NotaTitulo
              docId={doc.id}
              inicial={doc.nome || "Sem título"}
              urlKey={urlKey}
            />
            <form action={apagarNotaAction} className="shrink-0">
              <input type="hidden" name="docId" value={doc.id} />
              {urlKey ? <input type="hidden" name="key" value={urlKey} /> : null}
              <DeleteButton
                what={`o documento "${doc.nome || "Sem título"}"`}
                label="Apagar"
              />
            </form>
          </div>
          <EIView
            docId={doc.id}
            urlKey={urlKey}
            initialBlocks={doc.blocks}
            atualizadoAt={doc.updatedAt}
          />
        </div>
      </div>
    </AdminShell>
  );
}
