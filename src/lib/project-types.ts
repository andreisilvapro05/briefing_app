import type { ProjectType, ProjectTypeOption, EtapaProjeto } from "./types";

/**
 * Opções de projeto exibidas na Tela 2 (Escolha do fluxo).
 * Cada opção determina a timeline e quais blocos do briefing aparecem.
 */
export const PROJECT_TYPE_OPTIONS: ProjectTypeOption[] = [
  {
    id: "landing-com-copy",
    title: "Landing Page com copy",
    description: "A Fysi escreve a copy estratégica e desenha a página.",
    durationLabel: "≈ 4 semanas",
    hasCopyStep: true,
  },
  {
    id: "landing-sem-copy",
    title: "Landing Page sem copy",
    description: "Você envia os textos prontos. A Fysi cuida do design.",
    durationLabel: "≈ 3 semanas",
    hasCopyStep: false,
  },
  {
    id: "site-completo",
    title: "Site completo",
    description: "Múltiplas páginas, com ou sem copy. Definimos a seguir.",
    durationLabel: "≈ 5 semanas",
    hasCopyStep: true,
  },
];

/**
 * Timeline de etapas mostrada ao cliente no dashboard.
 * Onboarding sempre está em-andamento — é onde o cliente está agora.
 */
export function buildTimeline(projectType: ProjectType): EtapaProjeto[] {
  const onboarding: EtapaProjeto = {
    numero: 1,
    titulo: "Onboarding",
    prazo: "3 dias",
    atividades: [
      "Assinatura de contrato",
      "Preenchimento do briefing",
      "Envio de fotos, links e dados",
      "Chamada de alinhamento com moodboard",
    ],
    status: "em-andamento",
  };

  const copyStep: EtapaProjeto = {
    numero: 2,
    titulo: "Criação da copy",
    prazo: "5–6 dias úteis",
    atividades: [
      "Redação estratégica",
      "Estruturação do funil textual",
    ],
    status: "pendente",
  };

  const designStep: EtapaProjeto = {
    numero: 0,
    titulo:
      projectType === "site-completo"
        ? "Prévia visual completa do site"
        : "Prévia visual no Figma",
    prazo: "5–6 dias úteis",
    atividades:
      projectType === "site-completo"
        ? ["Design de múltiplas páginas com base na copy aprovada"]
        : ["Design da landing page com base na copy aprovada"],
    status: "pendente",
  };

  const ajustes: EtapaProjeto = {
    numero: 0,
    titulo: "Ajustes",
    prazo: "3 rodadas inclusas",
    atividades: ["Refinamentos no design e/ou copy"],
    status: "pendente",
  };

  const implementacao: EtapaProjeto = {
    numero: 0,
    titulo: "Implementação e otimização",
    prazo: "3–4 dias após aprovação",
    atividades: [
      "Integração de pixel",
      "Instalação de tags",
      "Otimização de velocidade",
    ],
    status: "pendente",
  };

  const entrega: EtapaProjeto = {
    numero: 0,
    titulo: "Documento de entrega",
    prazo: "Final",
    atividades: ["Tutoriais, backup, acessos e documentação"],
    status: "pendente",
  };

  const etapas =
    projectType === "landing-sem-copy"
      ? [onboarding, designStep, ajustes, implementacao, entrega]
      : [onboarding, copyStep, designStep, ajustes, implementacao, entrega];

  // Renumera sequencialmente (já que landing-sem-copy pula a etapa 2 do PRD)
  return etapas.map((etapa, idx) => ({ ...etapa, numero: idx + 1 }));
}
