import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { getTemplateDocumentId, listEIDocuments } from "@/lib/ei-documents-server";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

/**
 * Índice dos Documentos de Briefing: manda pro Modelo (ou pro primeiro
 * documento que existir). Sem nenhum documento, mostra estado vazio — antes
 * redirecionava pra id vazio e entrava em loop de redirect.
 */
export default async function BriefingDocumentosIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const destinoId =
    (await getTemplateDocumentId("briefing")) ??
    (await listEIDocuments("briefing"))[0]?.id ??
    null;

  if (destinoId) redirect(`/admin/briefing-documentos/${destinoId}${kp}`);

  return (
    <AdminShell
      active="briefing-documentos"
      keyParam={kp}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Documentos de Briefing
        </h1>
      </header>
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-10 text-center">
        <p className="text-fysi-deep font-medium mb-1">
          Nenhum documento de briefing ainda
        </p>
        <p className="text-sm text-fysi-muted max-w-md mx-auto">
          O documento de briefing de um projeto é criado a partir da ficha do
          cliente. Abra um cliente em{" "}
          <Link href={`/admin${kp}`} className="text-fysi-deep underline">
            Clientes
          </Link>{" "}
          pra criar o primeiro.
        </p>
      </section>
    </AdminShell>
  );
}
