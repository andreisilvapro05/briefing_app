import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { EntregaViewer } from "@/components/entrega-viewer";
import { EntregaPrintButton } from "@/components/entrega-print-button";
import type { EntregaDocumento } from "@/lib/entrega";

export const dynamic = "force-dynamic";

/**
 * Página PÚBLICA compartilhável do Documento de Entrega de Projeto (DEP).
 *
 * O cliente abre pelo magic_slug — mesmo mecanismo do /painel/[slug] — e vê
 * o pacote final que a Fysi entrega: acessos, tutoriais, garantia, checklists
 * etc. Estilo cliente (cream quente, caloroso), pronto pra baixar em PDF via
 * o diálogo de impressão do browser.
 */
export default async function EntregaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select(
      "id, nome, empresa, entrega_documento, entrega_finalizada_at"
    )
    .eq("magic_slug", slug)
    .maybeSingle();

  if (!data) notFound();

  const entrega = (data.entrega_documento as EntregaDocumento | null) ?? null;
  const finalizadaAt = data.entrega_finalizada_at ?? null;
  const nome = data.nome as string | undefined;
  const empresa = (data.empresa as string | null) ?? undefined;

  // Só é considerada uma entrega "publicada" quando o admin finaliza.
  const disponivel = Boolean(entrega && finalizadaAt);

  return (
    <Shell contextLabel="Entrega" sectionLabel="Documento de Entrega">
      {/* CSS de impressão — vira um PDF limpo:
          esconde header/footer/botões e zera margens/sombras do container. */}
      <style>{`
        @media print {
          @page { margin: 16mm; }
          header, footer { display: none !important; }
          .entrega-print-hide { display: none !important; }
          .entrega-print-frame {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          html, body {
            background: #ffffff !important;
          }
          #dep-content {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <ContentFrame size="lg" className="entrega-print-frame">
        {disponivel && entrega ? (
          <>
            {/* Cabeçalho da página com o botão de baixar PDF */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 entrega-print-hide">
              <div>
                <p className="fysi-eyebrow">Documento de Entrega</p>
                <h1 className="fysi-display text-3xl md:text-4xl mt-2 text-fysi-deep">
                  {empresa || nome || "Seu projeto"}
                </h1>
                <p className="text-sm text-fysi-muted mt-2 max-w-md leading-relaxed">
                  Tudo que você precisa do seu projeto está aqui. Baixe uma
                  cópia em PDF e guarde com carinho.
                </p>
              </div>
              <EntregaPrintButton />
            </div>

            <EntregaViewer
              clientId={data.id as string}
              clientName={nome}
              empresa={empresa}
              entrega={entrega}
              finalizadaAt={finalizadaAt}
            />
          </>
        ) : (
          <EmptyState nome={empresa || nome} />
        )}
      </ContentFrame>
    </Shell>
  );
}

/**
 * Estado vazio amável — quando a entrega ainda não foi finalizada pela Fysi.
 */
function EmptyState({ nome }: { nome?: string }) {
  return (
    <div className="mx-auto max-w-lg text-center py-10">
      <div className="text-5xl mb-5" aria-hidden>
        🎁
      </div>
      <h1 className="fysi-display text-3xl md:text-4xl text-fysi-deep">
        Sua entrega está a caminho
      </h1>
      <p className="text-sm text-fysi-muted mt-4 leading-relaxed">
        {nome ? `Oi, ${nome}! ` : "Oi! "}
        Seu Documento de Entrega de Projeto ainda está sendo finalizado pela
        equipe da Fysi. Assim que estiver pronto, ele aparece aqui — com todos
        os acessos, tutoriais e a garantia do seu projeto.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-fysi-mint border border-fysi-mint-vivid/30 px-4 py-2 text-xs font-medium text-fysi-deep">
        <span aria-hidden>💚</span> Qualquer dúvida, fala com a gente no
        WhatsApp
      </div>
    </div>
  );
}
