/**
 * Em que etapa da linha do tempo o CLIENTE deve ver o projeto, derivado do
 * status que a equipe já mantém.
 *
 * Por que existe: o app tinha TRÊS fontes independentes pra "onde o projeto
 * está" — `clients.status` (os 14 valores do quadro, mexidos todo dia pelo
 * StatusChanger), `clients.current_stage_index` (0..n, um número que só
 * muda se alguém lembrar) e as tarefas. A linha do tempo do painel do
 * cliente lia a segunda. Resultado: a equipe movia o projeto no quadro e o
 * cliente continuava vendo "Onboarding" por semanas.
 *
 * Aqui o índice sai do status. Nada de campo novo pra ninguém lembrar de
 * atualizar — mover o projeto no quadro passa a mover o que o cliente vê.
 *
 * A linha do tempo tem formas diferentes por tipo de projeto (ver
 * buildTimeline), então o mapa devolve uma ETAPA NOMEADA e quem chama
 * traduz pro índice da sua lista. Assim uma etapa a mais em SEO não
 * desalinha tudo.
 */

export type EtapaCliente =
  | "onboarding"
  | "copy"
  | "design"
  | "ajustes"
  | "implementacao"
  | "entrega";

/**
 * Status do projeto → etapa que o cliente vê.
 *
 * "parado" e "nem-comecou-nada" ficam no onboarding de propósito: pro
 * cliente, projeto parado não andou. Quem precisa saber que está parado é
 * a equipe, e pra isso existe o marcador na Lista.
 */
const MAPA: Record<string, EtapaCliente> = {
  parado: "onboarding",
  "nem-comecou-nada": "onboarding",
  "a-iniciar": "onboarding",
  onboarding: "onboarding",
  "envio-informacoes": "onboarding",
  "em-andamento": "copy",
  "redacao-copy": "copy",
  "design-pagina": "design",
  "validacao-design-copy": "design",
  "ajustes-design-copy": "ajustes",
  implementacao: "implementacao",
  "validacao-implementacao": "implementacao",
  "ajuste-implementacao": "implementacao",
  "otimizacao-entrega": "entrega",
  concluido: "entrega",
  "completo-entregue": "entrega",
};

export function etapaDoCliente(status: string | null): EtapaCliente {
  return MAPA[(status ?? "").trim()] ?? "onboarding";
}

/** Ordem das etapas, pra comparar "andou mais que". */
const ORDEM: EtapaCliente[] = [
  "onboarding",
  "copy",
  "design",
  "ajustes",
  "implementacao",
  "entrega",
];

export function ordemDaEtapa(e: EtapaCliente): number {
  return ORDEM.indexOf(e);
}

/**
 * Índice na linha do tempo, dado o status e os títulos das etapas daquele
 * tipo de projeto.
 *
 * Casa por palavra no título porque cada tipo nomeia a etapa do seu jeito
 * ("Prévia visual no Figma", "Design de múltiplas páginas"). Se nenhum
 * título casar — SEO, que tem auditoria e estratégia no lugar de copy e
 * design —, cai numa proporção: etapa 3 de 6 vira a 3ª de quantas houver.
 *
 * @param manual valor de `current_stage_index` já gravado. O resultado
 * nunca volta atrás dele: alguém pode ter avançado a mão, e desfazer isso
 * seria o app contradizendo a equipe na frente do cliente.
 */
export function indiceNaLinhaDoTempo(
  status: string | null,
  titulos: string[],
  manual = 0
): number {
  if (titulos.length === 0) return Math.max(0, manual);
  const etapa = etapaDoCliente(status);

  const casa = titulos.findIndex((t) => {
    const n = t.toLowerCase();
    switch (etapa) {
      case "onboarding":
        return n.includes("onboarding");
      case "copy":
        return n.includes("copy");
      case "design":
        return n.includes("design") || n.includes("prévia") || n.includes("previa");
      case "ajustes":
        return n.includes("ajuste");
      case "implementacao":
        return n.includes("implementa");
      case "entrega":
        return n.includes("entrega");
    }
  });

  const derivado =
    casa >= 0
      ? casa
      : Math.min(
          titulos.length - 1,
          Math.round((ordemDaEtapa(etapa) / (ORDEM.length - 1)) * (titulos.length - 1))
        );

  return Math.min(titulos.length - 1, Math.max(derivado, Math.max(0, manual)));
}
