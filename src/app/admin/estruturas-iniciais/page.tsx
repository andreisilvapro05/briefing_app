import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember, hasFinanceAccess } from "@/lib/member";
import { getTemplateDocument, listEIDocuments } from "@/lib/ei-documents-server";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

/**
 * Índice das Estruturas Iniciais: manda pro Modelo (ou pro primeiro
 * documento que existir). Se NÃO houver nenhum documento, mostra um estado
 * vazio — antes redirecionava pra `/estruturas-iniciais/` (id vazio), que
 * voltava pro índice e entrava em loop de redirect.
 */
export default async function EstruturasIniciaisIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const kp = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  const template = await getTemplateDocument("ei");
  const destinoId = template?.id ?? (await listEIDocuments("ei"))[0]?.id ?? null;

  if (destinoId) redirect(`/admin/estruturas-iniciais/${destinoId}${kp}`);

  return (
    <AdminShell
      active="estruturas-iniciais"
      keyParam={kp}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Estruturas Iniciais
        </h1>
      </header>
      <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-10 text-center">
        <p className="text-fysi-deep font-medium mb-1">
          Nenhuma Estrutura Inicial ainda
        </p>
        <p className="text-sm text-fysi-muted max-w-md mx-auto">
          A Estrutura Inicial de um projeto é criada a partir da ficha do
          cliente, na aba <strong>EI</strong>. Abra um cliente em{" "}
          <Link href={`/admin${kp}`} className="text-fysi-deep underline">
            Clientes
          </Link>{" "}
          pra criar a primeira.
        </p>
      </section>
    </AdminShell>
  );
}
