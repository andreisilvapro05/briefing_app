"use client";

import { RadioGroup } from "@/components/ui/radio-group";
import { FieldGroup } from "./bloco-shell";
import { useBriefingField } from "@/lib/briefing-store";

const BLOCO = "linguagem-tom";

const SCALE_OPTIONS = (left: string, right: string) => [
  { value: "esquerda", label: left },
  { value: "meio", label: "Meio termo" },
  { value: "direita", label: right },
];

export function BlocoLinguagemTom() {
  const [acessivel, setAcessivel] = useBriefingField(
    BLOCO,
    "acessivel-premium",
    ""
  );
  const [moderno, setModerno] = useBriefingField(
    BLOCO,
    "moderno-conservador",
    ""
  );
  const [clean, setClean] = useBriefingField(BLOCO, "clean-informacao", "");
  const [humano, setHumano] = useBriefingField(BLOCO, "humano-tecnico", "");
  const [descontraido, setDescontraido] = useBriefingField(
    BLOCO,
    "descontraido-reservado",
    ""
  );

  const items: {
    id: string;
    legend: string;
    left: string;
    right: string;
    value: string;
    setter: (v: string) => void;
  }[] = [
    {
      id: "acessivel-premium",
      legend: "Sua comunicação é mais para o lado…",
      left: "Acessível",
      right: "Premium",
      value: acessivel,
      setter: setAcessivel,
    },
    {
      id: "moderno-conservador",
      legend: "Sua comunicação é mais…",
      left: "Moderno",
      right: "Conservador",
      value: moderno,
      setter: setModerno,
    },
    {
      id: "clean-informacao",
      legend: "Gostaria de algo mais…",
      left: "Clean / minimalista",
      right: "Mais informação visual",
      value: clean,
      setter: setClean,
    },
    {
      id: "humano-tecnico",
      legend: "Sua personalidade é mais…",
      left: "Humano",
      right: "Técnico",
      value: humano,
      setter: setHumano,
    },
    {
      id: "descontraido-reservado",
      legend: "Sua personalidade é mais…",
      left: "Descontraído",
      right: "Reservado",
      value: descontraido,
      setter: setDescontraido,
    },
  ];

  return (
    <FieldGroup
      title="Eixos de comunicação"
      description="Para cada par, escolha o ponto que melhor representa sua marca. Não há resposta certa — estamos calibrando o tom."
    >
      <div className="flex flex-col gap-6">
        {items.map((item) => (
          <RadioGroup
            key={item.id}
            name={item.id}
            legend={item.legend}
            layout="scale"
            value={item.value}
            onChange={item.setter}
            options={SCALE_OPTIONS(item.left, item.right)}
            scaleLabels={{ left: item.left, right: item.right }}
          />
        ))}
      </div>
    </FieldGroup>
  );
}
