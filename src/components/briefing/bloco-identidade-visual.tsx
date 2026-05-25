"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "identidade-visual";

export function BlocoIdentidadeVisual() {
  const [coresAnexos, setCoresAnexos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "cores-anexos",
    []
  );
  const [coresDescricao, setCoresDescricao] = useBriefingField(
    BLOCO,
    "cores-descricao",
    ""
  );
  const [corProibida, setCorProibida] = useBriefingField(
    BLOCO,
    "cor-proibida",
    ""
  );
  const [corProibidaQual, setCorProibidaQual] = useBriefingField(
    BLOCO,
    "cor-proibida-qual",
    ""
  );
  const [dinamicaCores, setDinamicaCores] = useBriefingField(
    BLOCO,
    "dinamica-cores",
    ""
  );
  const [fonteNome, setFonteNome] = useBriefingField(BLOCO, "fonte-nome", "");
  const [estiloTipografico, setEstiloTipografico] = useBriefingField(
    BLOCO,
    "estilo-tipografico",
    ""
  );
  const [temFotos, setTemFotos] = useBriefingField(BLOCO, "tem-fotos", "");
  const [fotos, setFotos] = useBriefingField<UploadedFile[]>(
    BLOCO,
    "fotos",
    []
  );

  return (
    <>
      <FieldGroup
        title="Cores"
        description="Se a marca já tem manual de identidade, anexe abaixo. Caso contrário, descreva o que tem em mente."
      >
        <FileUpload
          label="Manual de marca / paleta (se houver)"
          accept="image/*,application/pdf"
          value={coresAnexos}
          onChange={setCoresAnexos}
          pathPrefix="identidade-visual"
        />
        <Textarea
          label="Descrição das cores"
          name="cores-descricao"
          rows={4}
          value={coresDescricao}
          onChange={(e) => setCoresDescricao(e.target.value)}
          placeholder="Liste códigos hex, nomes, ou descreva uma direção (ex: tons terrosos, paleta sóbria...)"
          audioTranscribe
        />

        <RadioGroup
          name="cor-proibida"
          legend="Existe alguma cor que NÃO deve ser usada?"
          value={corProibida}
          onChange={setCorProibida}
          layout="pills"
          options={[
            { value: "nao", label: "Não" },
            { value: "sim", label: "Sim" },
          ]}
        />
        {corProibida === "sim" ? (
          <Input
            label="Qual cor evitar?"
            name="cor-proibida-qual"
            value={corProibidaQual}
            onChange={(e) => setCorProibidaQual(e.target.value)}
            placeholder="Ex: Rosa, vermelho, qualquer tom dourado..."
          />
        ) : null}

        <RadioGroup
          name="dinamica-cores"
          legend="Como prefere a dinâmica de cores na página?"
          value={dinamicaCores}
          onChange={setDinamicaCores}
          options={[
            {
              value: "fundo-escuro",
              label: "Uma única cor de fundo (mais escuro)",
              description: "Página inteira sobre a cor primária escura.",
            },
            {
              value: "fundo-claro",
              label: "Uma única cor de fundo (mais claro)",
              description: "Página inteira sobre cor clara/cream.",
            },
            {
              value: "intercalar",
              label: "Intercalar cores no fundo com blocos",
              description: "Blocos alternando entre claro e escuro.",
            },
          ]}
        />
      </FieldGroup>

      <FieldGroup
        title="Tipografia"
        description="Se já tem fonte definida, informe o nome (ex: Inter, Söhne, Manrope). Os arquivos da fonte você pode colocar direto na pasta do Drive."
      >
        <Input
          label="Nome da fonte"
          name="fonte-nome"
          optional
          value={fonteNome}
          onChange={(e) => setFonteNome(e.target.value)}
          placeholder="Ex: Inter, Söhne, ou ainda não tenho"
        />
        <RadioGroup
          name="estilo-tipografico"
          legend="Estilo tipográfico"
          value={estiloTipografico}
          onChange={setEstiloTipografico}
          options={[
            { value: "serifada-titulos", label: "Serifada nos títulos" },
            {
              value: "nao-serifada-textos",
              label: "Não serifada nos textos",
            },
            { value: "sem-serifada", label: "Não usar serifadas" },
          ]}
        />
      </FieldGroup>

      <FieldGroup
        title="Fotos profissionais"
        description="Se já fez book ou ensaio profissional, envie aqui — ajuda muito no design."
      >
        <RadioGroup
          name="tem-fotos"
          legend="Tem fotos profissionais já produzidas?"
          value={temFotos}
          onChange={setTemFotos}
          layout="pills"
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]}
        />
        {temFotos === "sim" ? (
          <FileUpload
            label="Upload das fotos"
            hint="Pode enviar várias. Aceita JPG, PNG, WEBP."
            accept="image/*"
            value={fotos}
            onChange={setFotos}
            pathPrefix="fotos"
            maxFiles={50}
          />
        ) : null}
      </FieldGroup>
    </>
  );
}
