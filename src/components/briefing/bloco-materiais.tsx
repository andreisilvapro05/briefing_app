"use client";

import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "materiais";

/**
 * Bloco "Materiais" — primeira parada do briefing. Concentra todos os
 * uploads em um lugar só, organizados por categoria. Cada categoria vira
 * uma field_id distinta no banco, o que dispara a categorização correta
 * em:
 *   - Painel de materiais do admin (lib/file-categories.ts)
 *   - ZIP organizado (/api/admin/files/zip)
 *   - Subpasta no Drive quando ativo (lib/google-drive.ts)
 *
 * A ideia é que o cliente jogue tudo aqui de uma vez, depois passa pelas
 * perguntas tranquilo.
 */
export function BlocoMateriais() {
  const [logo, setLogo] = useBriefingField<UploadedFile[]>(BLOCO, "logo", []);
  const [identidade, setIdentidade] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "identidade-visual",
    []
  );
  const [imagens, setImagens] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "imagens",
    []
  );
  const [depoimentos, setDepoimentos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "depoimentos",
    []
  );
  const [documentos, setDocumentos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "documentos",
    []
  );
  const [outros, setOutros] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "outros",
    []
  );

  const total =
    logo.length +
    identidade.length +
    imagens.length +
    depoimentos.length +
    documentos.length +
    outros.length;

  return (
    <>
      <div className="rounded-[16px] bg-fysi-mint border border-fysi-mint-vivid/30 px-4 py-3 mb-6">
        <p className="text-sm text-fysi-deep leading-relaxed">
          <strong>Por que isso aqui no começo?</strong> Junte todos os
          materiais que você já tem (logo, fotos, depoimentos, manual de marca)
          numa coisa só. Cada arquivo vai pra pasta certa automaticamente e
          a Fysi consegue começar a produção sem precisar correr atrás depois.
          {total > 0 ? (
            <span className="block mt-2 text-fysi-deep/80">
              ✓ {total} arquivo{total === 1 ? "" : "s"} já enviado
              {total === 1 ? "" : "s"}.
            </span>
          ) : null}
        </p>
      </div>

      <FieldGroup
        title="🏷️ Logo"
        description="Arquivos da sua marca (preferência por SVG ou PNG transparente; AI/PSD também serve)."
      >
        <FileUpload
          accept="image/*,.svg,.ai,.eps,.psd,application/pdf"
          value={logo}
          onChange={setLogo}
          pathPrefix={`${BLOCO}.logo`}
          hint="Pode ser mais de um (versão principal, monocromática, ícone...)."
        />
      </FieldGroup>

      <FieldGroup
        title="🎨 Identidade visual"
        description="Manual de marca, paleta de cores, tipografia — se você já tem documentado."
      >
        <FileUpload
          accept="image/*,application/pdf,.ai,.psd"
          value={identidade}
          onChange={setIdentidade}
          pathPrefix={`${BLOCO}.identidade-visual`}
          hint="Sem problema se ainda não tiver — você descreve depois nos blocos seguintes."
        />
      </FieldGroup>

      <FieldGroup
        title="📸 Imagens e fotos"
        description="Fotos da equipe, ambiente, produto, eventos — tudo que pode aparecer na página."
      >
        <FileUpload
          accept="image/*"
          value={imagens}
          onChange={setImagens}
          pathPrefix={`${BLOCO}.imagens`}
          hint="Quanto melhor a qualidade, melhor o resultado final."
        />
      </FieldGroup>

      <FieldGroup
        title="💬 Depoimentos"
        description="Prints de WhatsApp, vídeos, áudios ou textos de clientes satisfeitos."
      >
        <FileUpload
          accept="image/*,video/*,audio/*,application/pdf"
          value={depoimentos}
          onChange={setDepoimentos}
          pathPrefix={`${BLOCO}.depoimentos`}
          hint="Aparecem na página como prova social — caixa de áudio também funciona."
        />
      </FieldGroup>

      <FieldGroup
        title="📄 Documentos"
        description="Texto pronto da copy, currículo, apresentações, planilhas com dados."
      >
        <FileUpload
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.doc,.docx,.pdf,.txt,.rtf"
          value={documentos}
          onChange={setDocumentos}
          pathPrefix={`${BLOCO}.documentos`}
          hint="PDFs, Word, planilhas, notas de texto."
        />
      </FieldGroup>

      <FieldGroup
        title="📁 Outros materiais"
        description="Qualquer coisa que não bateu em outra categoria."
      >
        <FileUpload
          value={outros}
          onChange={setOutros}
          pathPrefix={`${BLOCO}.outros`}
          hint="Brand books, portfólios de concorrentes, prints, qualquer coisa relevante."
        />
      </FieldGroup>
    </>
  );
}
