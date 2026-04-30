"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "textos-prontos";

export function BlocoTextosProntos() {
  const [arquivos, setArquivos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "arquivos",
    []
  );
  const [linkDocs, setLinkDocs] = useBriefingField(BLOCO, "link-docs", "");
  const [observacoes, setObservacoes] = useBriefingField(
    BLOCO,
    "observacoes",
    ""
  );

  return (
    <FieldGroup
      title="Textos da página"
      description="Como você optou pelo formato sem copy, envie aqui os textos finais que devem aparecer."
    >
      <FileUpload
        label="Arquivos com os textos"
        hint="PDF, Word ou .txt. Pode enviar mais de um."
        accept=".pdf,.doc,.docx,.txt,.md,.rtf"
        value={arquivos}
        onChange={setArquivos}
        pathPrefix="textos-prontos"
      />
      <Input
        label="Link do Google Docs"
        name="link-docs"
        optional
        hint="Se preferir, compartilhe um link em vez de enviar arquivo. Garanta acesso de leitura para qualquer pessoa com o link."
        value={linkDocs}
        onChange={(e) => setLinkDocs(e.target.value)}
        placeholder="https://docs.google.com/..."
      />
      <Textarea
        label="Observações sobre os textos"
        rows={4}
        optional
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        placeholder="Ordem das seções, prioridades, partes que ainda estão em revisão, etc."
      />
    </FieldGroup>
  );
}
