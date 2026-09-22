import { redirect } from "next/navigation";
import {
  getCurrentMember,
  hasFinanceAccess,
  hasFullAccess,
  isAdmin,
} from "@/lib/member";
import { AdminShell } from "@/components/admin/admin-shell";
import { PrioridadesBoard } from "@/components/admin/prioridades-board";
import { listarIniciativas } from "@/lib/prioridades-server";

export const dynamic = "force-dynamic";

/**
 * Prioridades — o mapa de onde investir esforço.
 *
 * Pedido da Karine (2026-09-22): "ter uma parte de visualização também de
 * ordem de importância de execução (...) tanto para eu e a Tainá (comercial,
 * atendimento e marketing) como também para o Andrei na parte de processos e
 * gestão."
 *
 * O que está aqui NÃO é tarefa de projeto (isso é /admin/tarefas) nem demanda
 * interna (/admin/demandas): é a melhoria que a agência pode fazer pra ganhar
 * dia de projeto ou fechar mais contrato. Ela vive enquanto a agência existir.
 *
 * QUEM VÊ: `hasFullAccess` — admin (sócio), avançado e a sessão legada. O
 * mesmo corte de /admin/demandas, e pelo mesmo motivo: a tela diz onde o
 * faturamento trava e onde a agência vai investir. O papel "basico"
 * (designer) e o "desenvolvedor" não entram. Barrado aqui no servidor, antes
 * de qualquer HTML — esconder o item do menu não impede ninguém de digitar a
 * URL, e cada Server Action refaz a checagem por conta própria.
 */
export default async function PrioridadesPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const urlKey = params.key ?? null;
  const member = await getCurrentMember({ urlKey });
  if (!member) redirect("/admin/login");

  const keyParam = urlKey ? `?key=${encodeURIComponent(urlKey)}` : "";
  if (!hasFullAccess(member)) redirect(`/admin/meu-trabalho${keyParam}`);

  const iniciativas = await listarIniciativas();

  return (
    <AdminShell
      active="prioridades"
      keyParam={keyParam}
      userEmail={member.email}
      userName={member.name}
      userPhotoUrl={member.fotoUrl}
      canEditPhoto={member.source === "supabase"}
      isSocio={isAdmin(member)}
      hideFinance={!hasFinanceAccess(member)}
    >
      <header className="mb-6">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep">
          Prioridades
        </h1>
        <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
          O que a agência pode fazer pra ganhar tempo ou dinheiro, colocado
          lado a lado: o que muda muito e custa pouco fica no canto de cima à
          esquerda — é por ali que se começa.
        </p>
      </header>

      <PrioridadesBoard iniciativas={iniciativas} urlKey={urlKey} />
    </AdminShell>
  );
}
