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
    /**
     * ⚠️ FALTAVA AQUI — e era o que travava o painel da cliente de tráfego.
     *
     * `trafego` existe no union de `ProjectType` (types.ts) e no CHECK do
     * banco desde a migration 20260928120000 (pedido da Karine: "Carla é de
     * tráfego, precisaremos separar uma aba para esses clientes"), mas
     * nunca entrou nesta lista. O painel do cliente usa
     * `PROJECT_TYPE_OPTIONS` pra decidir se CONHECE o tipo: não achando,
     * devolvia pra tela "o que você contratou com a Fysi?" — que manda de
     * volta pro painel. Loop eterno, com "Carregando…" na tela.
     *
     * Era a ÚNICA cliente de tráfego do app (Carla's Cleaning Service), e
     * ela não conseguia ver o projeto desde 28/09.
     */
    id: "trafego",
    title: "Tráfego pago",
    description:
      "Campanhas, criativos e otimização contínua. Acompanhamento mensal.",
    durationLabel: "Mensal",
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

/** O valor é um tipo de projeto que o app conhece? */
export function ehProjectTypeConhecido(valor: string): valor is ProjectType {
  return PROJECT_TYPE_OPTIONS.some((o) => o.id === valor);
}

/**
 * Último índice de etapa válido para um tipo de projeto.
 *
 * DERIVADO da própria timeline, de propósito. O número estava escrito à
 * mão em DOIS lugares (`setProjectTypeAction` e `maxStageIndex` da Lista),
 * com formatos diferentes, e os dois diziam 5 pra qualquer tipo que não
 * fosse `landing-sem-copy` ou `outro` — então `trafego`, que tem 5 etapas,
 * ganhava limite 5 e o painel do cliente podia marcar TUDO como concluído.
 *
 * Com isto, acrescentar um tipo novo não exige lembrar de um terceiro
 * lugar: o limite sai da timeline que ele mesmo define.
 */
export function maxStageIndexDe(projectType: ProjectType): number {
  return Math.max(0, buildTimeline(projectType, 0).length - 1);
}

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
  } else if (projectType === "trafego") {
    /**
     * Tráfego é CONTÍNUO, não um projeto com entrega final: a timeline
     * reflete o ciclo mensal. Sem este ramo, cairia no `else` e a cliente
     * veria "Prévia visual no Figma" e "Documento de entrega" — etapas que
     * não existem no serviço dela.
     */
    etapas = [
      onboarding,
      {
        numero: 0,
        titulo: "Estratégia de campanha",
        prazo: "3–5 dias úteis",
        atividades: [
          "Definição de público e oferta",
          "Estrutura de campanhas e orçamento",
          "Configuração de pixel e conversões",
        ],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Criativos",
        prazo: "5 dias úteis",
        atividades: ["Produção de peças e variações", "Textos dos anúncios"],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Veiculação e otimização",
        prazo: "Contínuo",
        atividades: [
          "Subida das campanhas",
          "Testes e ajuste de verba",
          "Otimização por resultado",
        ],
        status: "pendente",
      },
      {
        numero: 0,
        titulo: "Relatório mensal",
        prazo: "Mensal",
        atividades: [
          "Resultados por campanha",
          "Custo por resultado e próximos passos",
        ],
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
