import { redirect } from "next/navigation";
import { getCurrentMember, hasFinanceAccess, hasFullAccess } from "@/lib/member";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProcessDocsExplorer } from "@/components/admin/process-docs-explorer";

export const dynamic = "force-dynamic";

export interface ProcessDocRow {
  id: string;
  titulo: string;
  categoria: string;
  audiencia: "equipe" | "cliente";
  link: string | null;
  descricao: string | null;
  fonte: string | null;
}

/**
 * Banco de processos & tutoriais — importado do ClickUp (pedido do usuário
 * 2026-09-01). Separado por audiência (equipe/cliente, confirmado com o
 * usuário) pra não misturar processo interno com tutorial pra mandar pro
 * cliente. Busca é toda client-side (ProcessDocsExplorer) — poucas
 * centenas de linhas, não precisa de round-trip por letra digitada.
 */
export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("process_docs")
    .select("id, titulo, categoria, audiencia, link, descricao, fonte")
    .order("audiencia", { ascending: true })
    .order("ordem", { ascending: true });
  const docs = (data as ProcessDocRow[]) ?? [];

  return (
    <AdminShell
      active="processos"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Processos &amp; Tutoriais
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          Banco pesquisável de processos internos e tutoriais, importado do
          ClickUp. Separado por audiência — não confunda um processo
          interno com um tutorial pra mandar pro cliente.
        </p>
      </header>

      <ProcessDocsExplorer
        docs={docs}
        urlKey={urlKey}
        podeEditar={hasFullAccess(member)}
      />
    </AdminShell>
  );
}
