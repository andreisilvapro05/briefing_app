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
  {
    id: "seo",
    title: "SEO",
    description:
      "Auditoria técnica, otimização on-page, conteúdo e monitoramento.",
    durationLabel: "≈ 6 semanas",
    hasCopyStep: false,
  },
  {
    id: "outro",
    title: "Outro serviço",
    description:
      "Escopo customizado. A timeline é ajustada caso a caso pela equipe.",
    durationLabel: "Sob medida",
    hasCopyStep: false,
  },
];

/**
 * Timeline de etapas mostrada ao cliente no dashboard.
 * Onboarding sempre está em-andamento — é onde o cliente está agora.
 */
export function buildTimeline(
  projectType: ProjectType,
  currentStageIndex: number = 0
): EtapaProjeto[] {
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
    status: "pendente",
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

  // Timeline customizada por tipo de projeto
  let etapas: EtapaProjeto[];

  if (projectType === "seo") {
    etapas = [
      onboarding,
      {
        numero: 0,
        titulo: "Auditoria SEO",
        prazo: "5–7 dias úteis",
        atividades: [
          "Análise técnica do site",
          "Auditoria de conteúdo e palavras-chave",
          "Diagnóstico de concorrência",
        ],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Estratégia e plano de ação",
        prazo: "3 dias úteis",
        atividades: [
          "Definição de palavras-chave alvo",
          "Roadmap de otimizações",
          "Plano de conteúdo",
        ],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Otimização on-page",
        prazo: "1–2 semanas",
        atividades: [
          "Ajustes técnicos (meta tags, schema, velocidade)",
          "Otimização de páginas existentes",
        ],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Conteúdo e link building",
        prazo: "1–2 semanas",
        atividades: [
          "Produção de novos conteúdos",
          "Estratégia de autoridade e backlinks",
        ],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Relatório e monitoramento",
        prazo: "Mensal",
        atividades: [
          "Acompanhamento de rankings",
          "Relatório de tráfego e conversões",
        ],
        status: "pendente",
      },
    ];
  } else if (projectType === "outro") {
    etapas = [
      onboarding,
      {
        numero: 0,
        titulo: "Planejamento",
        prazo: "A definir",
        atividades: ["Escopo, prazos e entregáveis customizados"],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Execução",
        prazo: "A definir",
        atividades: ["Produção conforme combinado com o time Fysi"],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Entrega",
        prazo: "Final",
        atividades: ["Revisão, ajustes finais e documentação"],
        status: "pendente",
      },
    ];
  } else if (projectType === "landing-sem-copy") {
    etapas = [onboarding, designStep, ajustes, implementacao, entrega];
  } else {
    etapas = [onboarding, copyStep, designStep, ajustes, implementacao, entrega];
  }

  // Renumera sequencialmente e aplica o status com base no currentStageIndex
  return etapas.map((etapa, idx) => ({
    ...etapa,
    numero: idx + 1,
    status:
      idx < currentStageIndex
        ? "concluida"
        : idx === currentStageIndex
          ? "em-andamento"
          : "pendente",
  }));
}
