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
            {/* Paleta: as referências visuais ainda estão sendo montadas. */}
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="text-fysi-deep/70"
            >
              <path d="M12 3a9 9 0 1 0 0 18c.9 0 1.5-.7 1.5-1.5 0-.4-.15-.75-.4-1-.25-.26-.4-.6-.4-1 0-.83.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8z" />
              <circle cx="7.5" cy="11.5" r="1.1" />
              <circle cx="11" cy="7.5" r="1.1" />
              <circle cx="15.5" cy="8.5" r="1.1" />
            </svg>
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
