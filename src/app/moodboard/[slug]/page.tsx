import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { MoodboardView } from "@/components/moodboard-view";
import type { Moodboard, MoodboardStatus } from "@/lib/moodboard";

export const dynamic = "force-dynamic";

/**
 * Página PÚBLICA compartilhável do moodboard — a Fysi manda o link
 * /moodboard/<magic_slug> pro cliente ver as referências visuais.
 *
 * Read-only, tela cliente (cream quente via Shell/ContentFrame). Só mostra o
 * moodboard quando ele já foi compartilhado (status ≠ "rascunho").
 */

// Status em que o moodboard já pode ser visto pelo cliente.
const SHAREABLE: MoodboardStatus[] = ["enviado", "em_revisao", "aprovado"];

export default async function MoodboardPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("nome, empresa, moodboard_data")
    .eq("magic_slug", slug)
    .maybeSingle();

  const moodboard = (data?.moodboard_data as Moodboard | null) ?? null;
  const disponivel =
    !!moodboard && SHAREABLE.includes(moodboard.status);

  const nomeExibicao = data?.empresa || data?.nome || null;

  return (
    <Shell contextLabel="Moodboard" sectionLabel={nomeExibicao ?? undefined}>
      <ContentFrame size="lg">
        {disponivel && moodboard ? (
          <MoodboardView moodboard={moodboard} />
        ) : (
          <div className="flex flex-col items-center text-center gap-4 py-20">
            <span className="text-4xl" aria-hidden>
              🎨
            </span>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fysi-deep">
              Moodboard ainda não disponível
            </h1>
            <p className="text-base leading-relaxed text-fysi-deep/70 max-w-md">
              As referências visuais deste projeto ainda estão sendo preparadas
              pela equipe da Fysi. Assim que estiverem prontas, você vai
              conseguir visualizá-las aqui neste mesmo link.
            </p>
          </div>
        )}
      </ContentFrame>
    </Shell>
  );
}
