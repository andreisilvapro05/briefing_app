import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow } from "@/components/ui/pill";
import { BriefingReadOnly } from "@/components/briefing-read-only";
import { obterCopyPorToken } from "@/lib/copy-server";
import { RespostaDaCopy } from "@/components/copy/resposta-da-copy";

export const dynamic = "force-dynamic";

/**
 * Página PÚBLICA da copy, aberta por token próprio — é aqui que o cliente
 * lê e aprova.
 *
 * Karine (26/09): "precisa ter no app para mandar para o cliente aprovar
 * também". Antes a copy ia por link do Drive e a aprovação voltava por
 * WhatsApp, onde se perdia.
 *
 * Mesmo desenho do briefing público: token de 128 bits, revogável,
 * separado do `magic_slug` — mandar a copy não pode dar acesso a valores,
 * contrato e ficha.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CopyPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await obterCopyPorToken(token);
  // Revogado, expirado ou inexistente caem no mesmo 404 — não se conta ao
  // visitante que o documento existe.
  if (!doc) notFound();

  const respondida = doc.situacao === "aprovada" || doc.situacao === "ajuste-pedido";

  return (
    <Shell>
      <ContentFrame>
        <header className="mb-6">
          <Eyebrow>Texto da sua página</Eyebrow>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-fysi-deep mt-1">
            {doc.cliente ?? "Sua copy"}
          </h1>
          <p className="text-fysi-muted text-sm mt-1 max-w-2xl">
            Leia com calma. Se estiver bom, aprove; se algo precisar mudar,
            escreva o que é — a gente ajusta e te manda de volta.
          </p>
        </header>

        <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-6 mb-6">
          <div className="fysi-doc">
            <BriefingReadOnly blocks={doc.blocks} />
          </div>
        </section>

        <RespostaDaCopy
          token={token}
          jaRespondeu={respondida}
          situacao={doc.situacao}
          comentario={doc.comentario}
        />
      </ContentFrame>
    </Shell>
  );
}
