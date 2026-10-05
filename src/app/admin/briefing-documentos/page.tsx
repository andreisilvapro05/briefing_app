import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * ENDEREÇO APOSENTADO — leva pro hub de Briefings.
 *
 * Havia DOIS hubs listando exatamente os mesmos registros (`ei_documents`
 * com kind "briefing"): este e /admin/briefings. O mesmo documento abria em
 * duas URLs com conjuntos de botões diferentes — lá tem link público,
 * vincular cliente, acessos, materiais, renomear, duplicar e apagar; aqui
 * só o editor. E as duas ações de criar divergiam: uma procurava o
 * briefing MAIS ANTIGO do cliente, a outra o MAIS RECENTE, então "novo
 * briefing" abria documentos DIFERENTES dependendo da tela de onde se
 * clicava.
 *
 * Karine (04/10): "está bagunçado". Agora é um hub só.
 *
 * O redirect fica (em vez de apagar a rota) porque os endereços antigos
 * estão em histórico de navegador e em links já mandados.
 */
export default async function BriefingDocumentosIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  redirect(`/admin/briefings${key ? `?key=${encodeURIComponent(key)}` : ""}`);
}
