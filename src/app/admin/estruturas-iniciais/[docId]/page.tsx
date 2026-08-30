import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
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
  const user = await getAdminUser({ urlKey });
  if (!user) redirect("/admin/login");

  const [docs, doc, clientsWithoutDoc] = await Promise.all([
    listEIDocuments(),
    getEIDocument(docId),
    listClientsWithoutEIDocument(),
  ]);

  if (!doc) redirect(`/admin/estruturas-iniciais${urlKey ? `?key=${encodeURIComponent(urlKey)}` : ""}`);

  const keyParamFirst = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  return (
    <AdminShell active="estruturas-iniciais" keyParam={keyParamFirst} userEmail={user.email}>
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
            clientName={doc.client?.nome ?? null}
            empresa={doc.isTemplate ? "Modelo" : (doc.client?.empresa ?? null)}
            urlKey={urlKey}
            initial={doc.eiData}
            atualizadoAt={doc.updatedAt}
            fallbackDrive={
              doc.client?.fysiDriveLink || doc.client?.clienteDriveLink || null
            }
          />
        </div>
      </div>
    </AdminShell>
  );
}
