/**
 * Estrutura Inicial (EI) — documento que a equipe de produção preenche
 * a partir do briefing, com tudo organizado por seção da página final.
 *
 * Template espelha o PDF "EI - Modelo" que a Sara usa hoje no Notion.
 */

export interface EISecao {
  /** Nome da seção (ex: "SEÇÃO 01", "Hero", "Sobre"). */
  nome: string;
  /** Observação interna (não vai pra página). */
  obs: string;
  /** Referência visual (link Behance, Dribbble, etc). */
  ref: string;
  /** Título principal da seção (vai pra página). */
  titulo: string;
  /** Texto/copy da seção (vai pra página). */
  texto: string;
  /** Texto de botão CTA (opcional). */
  cta: string;
}

export interface EIData {
  /** Bloco de Acesso */
  dadosAcesso: string;
  briefingLink: string;
  driveLink: string;
  logo: string;
  imagens: string;
  fonteLetra: string;
  cores: string;
  paginasReferencia: string;
  referenciasGerais: string;
  copyExterno: string;
  menuTem: string;

  /** Seções da landing/site (dinâmico — 1 ou mais) */
  secoes: EISecao[];

  /** Rodapé (texto livre) */
  rodape: string;
}

export const REFERENCIAS_PADRAO = [
  {
    nome: "Referência médicos",
    url: "https://www.behance.net/collection/198526883/medicos",
  },
  {
    nome: "Referência advogados",
    url: "https://www.behance.net/collection/202012045/Advogados",
  },
  {
    nome: "Referência negócios locais",
    url: "https://www.behance.net/collection/198405163/Lps-negocio-local",
  },
  {
    nome: "Referência lançamentos e geral",
    url: "https://www.behance.net/karinesacht/moodboards",
  },
];

export function emptyEI(): EIData {
  return {
    dadosAcesso: "",
    briefingLink: "",
    driveLink: "",
    logo: "",
    imagens: "",
    fonteLetra: "",
    cores: "",
    paginasReferencia: "",
    referenciasGerais: "",
    copyExterno: "",
    menuTem: "",
    secoes: [emptySecao("SEÇÃO 01")],
    rodape: "",
  };
}

export function emptySecao(nome: string): EISecao {
  return {
    nome,
    obs: "",
    ref: "",
    titulo: "",
    texto: "",
    cta: "",
  };
}

/**
 * Renderiza o EI como Markdown — formato pra exportar / copiar pro ClickUp.
 */
export function renderEIMarkdown(
  data: EIData,
  meta?: { clientName?: string; empresa?: string }
): string {
  const lines: string[] = [];
  const titulo = meta?.empresa || meta?.clientName || "Cliente";
  lines.push(`# EI · ${titulo}`);
  lines.push("");

  lines.push("## Dados de acesso domínio / hospedagem / WordPress");
  lines.push(data.dadosAcesso || "_a preencher_");
  lines.push("");

  lines.push("## Briefing");
  lines.push(data.briefingLink || "_a preencher_");
  lines.push("");

  if (data.driveLink) {
    lines.push(`**Link do Drive:** ${data.driveLink}`);
    lines.push("");
  }
  if (data.logo) {
    lines.push(`**Logo:** ${data.logo}`);
    lines.push("");
  }
  if (data.imagens) {
    lines.push(`**Imagens:** ${data.imagens}`);
    lines.push("");
  }
  if (data.fonteLetra) {
    lines.push(`**Fonte de letra:** ${data.fonteLetra}`);
    lines.push("");
  }
  if (data.cores) {
    lines.push(`**Cores:** ${data.cores}`);
    lines.push("");
  }
  if (data.paginasReferencia) {
    lines.push("**Páginas de referência:**");
    lines.push(data.paginasReferencia);
    lines.push("");
  }
  if (data.referenciasGerais) {
    lines.push("**Referências gerais:**");
    lines.push(data.referenciasGerais);
    lines.push("");
  }
  if (data.copyExterno) {
    lines.push("## Informações adicionais ou copy que o cliente enviou");
    lines.push(data.copyExterno);
    lines.push("");
  }

  lines.push("## COPY");
  if (data.menuTem) {
    lines.push(`**MENU:** ${data.menuTem}`);
    lines.push("");
  }

  data.secoes.forEach((s) => {
    lines.push(`### ${s.nome}`);
    if (s.obs) lines.push(`> obs: ${s.obs}`);
    if (s.ref) lines.push(`> ref: ${s.ref}`);
    lines.push("");
    if (s.titulo) lines.push(`**[Título]** ${s.titulo}`);
    if (s.texto) {
      lines.push("");
      lines.push(`**[Texto]**`);
      lines.push(s.texto);
    }
    if (s.cta) lines.push(`**[CTA]** ${s.cta}`);
    lines.push("");
  });

  lines.push("## RODAPÉ");
  lines.push(data.rodape || "_a preencher_");

  return lines.join("\n");
}
