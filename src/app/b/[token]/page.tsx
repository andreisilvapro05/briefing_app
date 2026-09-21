import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow } from "@/components/ui/pill";
import { obterBriefingPorToken } from "@/lib/briefings-server";
import { BriefingReadOnly } from "@/components/briefing-read-only";

export const dynamic = "force-dynamic";

/**
 * Página PÚBLICA de UM briefing, aberta por token próprio.
 *
 * Existe porque o briefing precisava sair de dentro da ficha do cliente:
 * mandar o briefing pra designer não pode significar dar acesso a valores,
 * contrato e ficha (pedido do usuário em 2026-09-20).
 *
 * Diferente do `magic_slug`, que abre painel + moodboard + entrega do
 * cliente de uma vez, este token vale por UM documento e é revogável.
 * Credenciais nunca chegam aqui — `obterBriefingPorToken` não as devolve.
 */

export const metadata: Metadata = {
  // Link compartilhado não é pra virar resultado de busca.
  robots: { index: false, follow: false },
};

export default async function BriefingPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await obterBriefingPorToken(token);
  // Revogado, expirado ou inexistente caem no mesmo 404 — não conta ao
  // visitante que o briefing existe.
  if (!doc) notFound();

  return (
    <Shell contextLabel="Briefing" sectionLabel={doc.titulo}>
      <ContentFrame size="lg">
        <header className="mb-8">
          <Eyebrow>Briefing</Eyebrow>
          <h1 className="fysi-display text-3xl md:text-4xl mt-2">
            {doc.titulo}
          </h1>
          {doc.clienteNome && doc.clienteNome !== doc.titulo ? (
            <p className="text-fysi-muted mt-2">{doc.clienteNome}</p>
          ) : null}
          <p className="text-xs text-fysi-muted mt-4 border-t border-fysi-line pt-4">
            Atualizado em{" "}
            {new Date(doc.updatedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            . Este link abre só este briefing — nada mais da conta do cliente.
          </p>
        </header>

        <article className="bg-white border border-fysi-line rounded-[24px] p-6 md:p-10">
          <BriefingReadOnly blocks={doc.blocks} />
        </article>

        <p className="text-xs text-fysi-muted mt-6 text-center">
          Fysi Lab Digital
        </p>
      </ContentFrame>
    </Shell>
  );
}
