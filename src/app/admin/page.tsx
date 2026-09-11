import { redirect } from "next/navigation";

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
  redirect(`/admin/visao-geral${key ? `?key=${encodeURIComponent(key)}` : ""}`);
}
