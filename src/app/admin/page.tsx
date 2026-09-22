import { redirect } from "next/navigation";
import { getCurrentMember, isDeveloper } from "@/lib/member";

export const dynamic = "force-dynamic";

/**
 * /admin leva direto pra Visão Geral (pedido da Karine 2026-09-11) — é o
 * painel que responde "como está a agência hoje", melhor porta de entrada
 * que a lista crua de clientes.
 *
 * A lista de clientes continua existindo, em /admin/clientes. Os links de
 * "voltar pra lista" espalhados pelo app apontam pra lá; os redirects de
 * acesso negado continuam caindo aqui, e a Visão Geral é destino melhor
 * pra eles também.
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const keyParam = key ? `?key=${encodeURIComponent(key)}` : "";

  // O papel "desenvolvedor" não alcança a Visão Geral (ela mostra a agência
  // inteira). Mandá-lo pra lá faria o AdminShell barrar e devolver pra cá —
  // dois redirects pra chegar no mesmo lugar. Vai direto pro que é dele.
  const member = await getCurrentMember({ urlKey: key ?? null });
  if (member && isDeveloper(member)) {
    redirect(`/admin/desenvolvimento${keyParam}`);
  }

  redirect(`/admin/visao-geral${keyParam}`);
}
