import { redirect } from "next/navigation";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { EIDocumentSidebar } from "@/components/admin/ei-document-sidebar";
import { EIView } from "@/components/admin/ei-view";
import {
  listEIDocuments,
  getEIDocument,
  listClientsWithoutEIDocument,
} from "@/lib/ei-documents-server";

export const dynamic = "force-dynamic";

export default async function EIDocumentPage({
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

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const visibleIds = await getVisibleClientIds(member);

  const [docsAll, doc, clientsWithoutDocAll] = await Promise.all([
    listEIDocuments("ei"),
    getEIDocument(docId),
    listClientsWithoutEIDocument("ei"),
  ]);

  if (!doc || doc.kind !== "ei") {
    redirect(`/admin/estruturas-iniciais${keyParamFirst}`);
  }
  // "basico" só acessa o Modelo (sem cliente) e os documentos dos clientes
  // em que tem tarefa atribuída — mesmo por URL direta.
  if (visibleIds && doc.clientId && !visibleIds.has(doc.clientId)) {
    redirect(`/admin/estruturas-iniciais${keyParamFirst}`);
  }

  const docs = visibleIds
    ? docsAll.filter((d) => !d.clientId || visibleIds.has(d.clientId))
    : docsAll;
  const clientsWithoutDoc = visibleIds
    ? clientsWithoutDocAll.filter((c) => visibleIds.has(c.id))
    : clientsWithoutDocAll;

  return (
    <AdminShell active="estruturas-iniciais" keyParam={keyParamFirst} userEmail={member.email} hideFinance={!hasFinanceAccess(member)}>
      {/*
        AdminShell's <main> tem px-4 md:px-6 lg:px-8 py-6 — cancelamos com
        margem negativa igual pra sidebar e painel encostarem nas bordas,
        e limitamos a altura ao viewport menos a topbar (h-14 = 3.5rem).
      */}
      <div className="flex -mx-4 md:-mx-6 lg:-mx-8 -my-6 h-[calc(100vh-3.5rem)]">
        <EIDocumentSidebar
          docs={docs}
          activeId={docId}
          urlKey={urlKey}
          clientsWithoutDoc={clientsWithoutDoc}
        />
        <div className="flex-1 overflow-y-auto p-6">
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
