import { Shell, ContentFrame } from "@/components/layout/shell";
import { Eyebrow } from "@/components/ui/pill";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <Shell tone="cream" sectionLabel="Acesso · Erro">
      <ContentFrame size="md">
        <Eyebrow>Não conseguimos validar o link</Eyebrow>
        <h1 className="fysi-display text-3xl mt-2 mb-4">
          Esse link expirou ou já foi usado.
        </h1>
        <p className="text-fysi-muted leading-relaxed">
          Volte à tela de identificação e solicite um novo acesso. Os dados
          que você já preencheu continuam salvos pelo seu e-mail.
        </p>
        {reason ? (
          <p className="mt-6 text-xs text-fysi-muted">
            Detalhe técnico: {reason}
          </p>
        ) : null}
      </ContentFrame>
    </Shell>
  );
}
