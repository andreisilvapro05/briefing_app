"use client";

import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "materiais";

/**
 * Bloco "Materiais" — primeira parada do briefing. Concentra todos os
 * uploads em um lugar só, organizados por categoria.
 *
 * Cada categoria tem duas opções (qualquer uma, ou nenhuma — tudo opcional):
 *   - Upload direto pra Supabase Storage
 *   - Cole link (Drive, Dropbox, WeTransfer, etc) — pra cliente que já tem
 *     tudo guardado em outro lugar
 *
 * Categorias com path-prefix válido (hifen, não ponto) e field_id que bate
 * com a categorização em lib/file-categories.ts.
 */
export function BlocoMateriais() {
  const [logo, setLogo] = useBriefingField<UploadedFile[]>(BLOCO, "logo", []);
  const [logoLink, setLogoLink] = useBriefingField(BLOCO, "logo-link", "");

  const [identidade, setIdentidade] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "identidade-visual",
    []
  );
  const [identidadeLink, setIdentidadeLink] = useBriefingField(
    BLOCO,
    "identidade-visual-link",
    ""
  );

  const [imagens, setImagens] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "imagens",
    []
  );
  const [imagensLink, setImagensLink] = useBriefingField(BLOCO, "imagens-link", "");

  const [depoimentos, setDepoimentos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "depoimentos",
    []
  );
  const [depoimentosLink, setDepoimentosLink] = useBriefingField(
    BLOCO,
    "depoimentos-link",
    ""
  );

  const [documentos, setDocumentos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "documentos",
    []
  );
  const [documentosLink, setDocumentosLink] = useBriefingField(
    BLOCO,
    "documentos-link",
    ""
  );

  const [outros, setOutros] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "outros",
    []
  );
  const [outrosLink, setOutrosLink] = useBriefingField(BLOCO, "outros-link", "");

  const totalArquivos =
    logo.length +
    identidade.length +
    imagens.length +
    depoimentos.length +
    documentos.length +
    outros.length;

  const hasLinks = !!(
    logoLink.trim() ||
    identidadeLink.trim() ||
    imagensLink.trim() ||
    depoimentosLink.trim() ||
    documentosLink.trim() ||
    outrosLink.trim()
  );

  return (
    <>
      <div className="rounded-[16px] bg-fysi-mint border border-fysi-mint-vivid/30 px-4 py-3 mb-6">
        <p className="text-sm text-fysi-deep leading-relaxed">
          <strong>Tudo aqui é opcional.</strong> Envie o que tiver pronto —
          arquivo ou link (Drive, Dropbox, WeTransfer, qualquer um). Pode pular
          o que não tem e voltar depois. A Fysi começa a produção com o que
          chegou primeiro.
          {totalArquivos > 0 || hasLinks ? (
            <span className="block mt-2 text-fysi-deep/80">
              ✓ {totalArquivos > 0 ? `${totalArquivos} arquivo${totalArquivos === 1 ? "" : "s"}` : ""}
              {totalArquivos > 0 && hasLinks ? " · " : ""}
              {hasLinks ? "link(s) salvo(s)" : ""}.
            </span>
          ) : null}
        </p>
      </div>

      <CategoriaMateriais
        titulo="🏷️ Logo"
        descricao="Arquivos da sua marca (preferência por SVG ou PNG transparente; AI/PSD também serve)."
        accept="image/*,.svg,.ai,.eps,.psd,application/pdf"
        files={logo}
        onFilesChange={setLogo}
        link={logoLink}
        onLinkChange={setLogoLink}
        pathSlug="materiais-logo"
        fileHint="Versão principal, monocromática, ícone..."
        linkPlaceholder="Cole aqui o link do Drive/Dropbox/Behance com a logo"
      />

      <CategoriaMateriais
        titulo="🎨 Identidade visual"
        descricao="Manual de marca, paleta de cores, tipografia — se já tem documentado."
        accept="image/*,application/pdf,.ai,.psd"
        files={identidade}
        onFilesChange={setIdentidade}
        link={identidadeLink}
        onLinkChange={setIdentidadeLink}
        pathSlug="materiais-identidade-visual"
        fileHint="Sem problema se ainda não tiver."
        linkPlaceholder="Link do Notion, Figma, Drive com manual de marca"
      />

      <CategoriaMateriais
        titulo="📸 Imagens e fotos"
        descricao="Fotos da equipe, ambiente, produto, eventos — tudo que pode aparecer na página."
        accept="image/*"
        files={imagens}
        onFilesChange={setImagens}
        link={imagensLink}
        onLinkChange={setImagensLink}
        pathSlug="materiais-imagens"
        fileHint="Quanto melhor a qualidade, melhor o resultado final."
        linkPlaceholder="Link do Drive/Dropbox com pasta de fotos"
      />

      <CategoriaMateriais
        titulo="💬 Depoimentos"
        descricao="Prints, vídeos, áudios ou textos de clientes."
        accept="image/*,video/*,audio/*,application/pdf"
        files={depoimentos}
        onFilesChange={setDepoimentos}
        link={depoimentosLink}
        onLinkChange={setDepoimentosLink}
        pathSlug="materiais-depoimentos"
        fileHint="Áudio de WhatsApp também funciona."
        linkPlaceholder="Link do Drive/YouTube/etc com depoimentos"
      />

      <CategoriaMateriais
        titulo="📄 Documentos"
        descricao="Copy pronta, planilhas, apresentações."
        accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.doc,.docx,.pdf,.txt,.rtf"
        files={documentos}
        onFilesChange={setDocumentos}
        link={documentosLink}
        onLinkChange={setDocumentosLink}
        pathSlug="materiais-documentos"
        fileHint="PDFs, Word, planilhas."
        linkPlaceholder="Link do Doc/Drive/Notion"
      />

      <CategoriaMateriais
        titulo="📁 Outros materiais"
        descricao="Qualquer coisa que não bateu em outra categoria."
        files={outros}
        onFilesChange={setOutros}
        link={outrosLink}
        onLinkChange={setOutrosLink}
        pathSlug="materiais-outros"
        fileHint="Brand books, refs de concorrentes, prints, qualquer coisa relevante."
        linkPlaceholder="Link de uma pasta ou material avulso"
      />
    </>
  );
}

/**
 * Card de uma categoria — upload + campo de link, ambos opcionais.
 */
function CategoriaMateriais({
  titulo,
  descricao,
  accept,
  files,
  onFilesChange,
  link,
  onLinkChange,
  pathSlug,
  fileHint,
  linkPlaceholder,
}: {
  titulo: string;
  descricao: string;
  accept?: string;
  files: UploadedFile[];
  onFilesChange: (next: UploadedFile[]) => void;
  link: string;
  onLinkChange: (v: string) => void;
  pathSlug: string;
  fileHint?: string;
  linkPlaceholder: string;
}) {
  return (
    <FieldGroup title={titulo} description={descricao}>
      <FileUpload
        accept={accept}
        value={files}
        onChange={onFilesChange}
        pathPrefix={pathSlug}
        hint={fileHint}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-fysi-muted hover:text-fysi-deep select-none">
          Prefere colar um link?
        </summary>
        <div className="mt-2">
          <Textarea
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            rows={2}
            placeholder={linkPlaceholder}
            hint="Cole 1 ou mais links (Drive, Dropbox, WeTransfer, YouTube…). Um por linha."
          />
        </div>
      </details>
    </FieldGroup>
  );
}
