import { redirect } from "next/navigation";
import { getCurrentMember, getVisibleClientIds, hasFinanceAccess } from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { EIDocumentSidebar } from "@/components/admin/ei-document-sidebar";
import { EIView } from "@/components/admin/ei-view";
import { createBriefingDocumentAction } from "@/app/admin/briefing-documentos/actions";
import {
  listEIDocuments,
  getEIDocument,
  listClientsWithoutEIDocument,
} from "@/lib/ei-documents-server";

export const dynamic = "force-dynamic";

/**
 * Hub de documentos de Briefing — mesmo padrão do hub de Estruturas
 * Iniciais (sidebar com lista + criar novo escolhendo o cliente), kind
 * "briefing" em vez de "ei". Pedido do usuário 2026-09-01: poder criar um
 * documento de briefing (pra usar numa call) e escolher de qual cliente é.
 */
export default async function BriefingDocumentPage({
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
    listEIDocuments("briefing"),
    getEIDocument(docId),
    listClientsWithoutEIDocument("briefing"),
  ]);

  if (!doc || doc.kind !== "briefing") {
    redirect(`/admin/briefing-documentos${keyParamFirst}`);
  }
  if (visibleIds && doc.clientId && !visibleIds.has(doc.clientId)) {
    redirect(`/admin/briefing-documentos${keyParamFirst}`);
  }

  const docs = visibleIds
    ? docsAll.filter((d) => !d.clientId || visibleIds.has(d.clientId))
    : docsAll;
  const clientsWithoutDoc = visibleIds
    ? clientsWithoutDocAll.filter((c) => visibleIds.has(c.id))
    : clientsWithoutDocAll;

  return (
    <AdminShell
      active="briefing-documentos"
      keyParam={keyParamFirst}
      userEmail={member.email}
      hideFinance={!hasFinanceAccess(member)}
    >
      <div className="flex -mx-4 md:-mx-6 lg:-mx-8 -my-6 h-[calc(100vh-3.5rem)]">
        <EIDocumentSidebar
          docs={docs}
          activeId={docId}
          urlKey={urlKey}
          clientsWithoutDoc={clientsWithoutDoc}
          basePath="/admin/briefing-documentos"
          createAction={createBriefingDocumentAction}
          createLabel="+ Novo documento de Briefing"
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
