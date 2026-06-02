"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "identidade-visual";

export function BlocoIdentidadeVisual() {
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

  return (
    <>
      <FieldGroup
        title="Cores"
        description="Se já enviou o manual de identidade lá no bloco Materiais, pule essa parte. Caso contrário, descreva o que tem em mente."
      >
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
        description="Se ainda não enviou fotos no bloco Materiais, marque aqui se já tem ensaio profissional."
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
          <p className="text-xs text-fysi-muted bg-fysi-cream/60 rounded-[10px] px-3 py-2">
            Volte ao bloco <strong>Materiais</strong> (Etapa 01) e envie em
            &quot;📸 Imagens e fotos&quot; — pode subir arquivo ou colar link
            do Drive.
          </p>
        ) : null}
      </FieldGroup>
    </>
  );
}
