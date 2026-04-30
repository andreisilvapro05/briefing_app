import type { ProjectType } from "./types";

/**
 * Metadados dos blocos do briefing.
 * Os campos são renderizados por componentes específicos em
 * `src/components/briefing/bloco-*.tsx` — manter ids estáveis.
 */

export interface BlocoMeta {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  // Calcula se o bloco aplica ao tipo de projeto.
  appliesTo: (projectType: ProjectType) => boolean;
}

export const BLOCOS: BlocoMeta[] = [
  {
    id: "identificacao-contatos",
    numero: 1,
    titulo: "Identificação e contatos",
    descricao:
      "Informações da marca e canais que vão aparecer na página final.",
    appliesTo: () => true,
  },
  {
    id: "identidade-visual",
    numero: 2,
    titulo: "Identidade visual",
    descricao:
      "Cores, tipografia e ativos visuais que orientam o design da página.",
    appliesTo: () => true,
  },
  {
    id: "linguagem-tom",
    numero: 3,
    titulo: "Linguagem e tom da marca",
    descricao: "Como a sua marca se comunica.",
    appliesTo: () => true,
  },
  {
    id: "referencias-concorrencia",
    numero: 4,
    titulo: "Referências e concorrência",
    descricao:
      "Inspirações, concorrentes e elementos visuais que servem como ponto de partida.",
    appliesTo: () => true,
  },
  {
    id: "briefing-copy",
    numero: 5,
    titulo: "Briefing de copy",
    descricao: "Material para que a Fysi escreva a copy estratégica.",
    appliesTo: (pt) => pt === "landing-com-copy" || pt === "site-completo",
  },
  {
    id: "textos-prontos",
    numero: 5,
    titulo: "Textos prontos",
    descricao: "Envie aqui os textos finais que devem ser usados na página.",
    appliesTo: (pt) => pt === "landing-sem-copy",
  },
];

export function blocosForProject(projectType: ProjectType): BlocoMeta[] {
  // Garante que apenas um dos dois (copy / textos-prontos) aparece.
  return BLOCOS.filter((b) => b.appliesTo(projectType));
}

export function blocoById(id: string): BlocoMeta | undefined {
  return BLOCOS.find((b) => b.id === id);
}
