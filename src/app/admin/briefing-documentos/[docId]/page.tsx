import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * ENDEREÇO APOSENTADO — leva pro mesmo documento no hub de Briefings.
 * Ver o comentário em ../page.tsx.
 */
export default async function BriefingDocumentoAntigoPage({
  params,
  searchParams,
}: {
  params: Promise<{ docId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { docId } = await params;
  const { key } = await searchParams;
  redirect(
    `/admin/briefings/doc/${docId}${key ? `?key=${encodeURIComponent(key)}` : ""}`
  );
}
