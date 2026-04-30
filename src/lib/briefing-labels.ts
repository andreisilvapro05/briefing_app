/**
 * Mapas de labels humanas para os campos do briefing e formatadores
 * de valores categóricos. Usado por:
 *   - Renderização do briefing no ClickUp (lib/clickup.ts)
 *   - E-mail de notificação pro time (lib/email.ts)
 *   - Painel admin (app/admin/[id]/page.tsx)
 *
 * Mantenha em sync com os componentes em components/briefing/bloco-*.tsx.
 */

export const FIELD_LABELS: Record<string, string> = {
  // bloco 1 — identificação e contatos
  "identificacao-contatos.logos": "Logo da marca",
  "identificacao-contatos.whatsapp-site": "WhatsApp para o site",
  "identificacao-contatos.telefone": "Telefone fixo",
  "identificacao-contatos.email-site": "E-mail para exibir no site",
  "identificacao-contatos.horario": "Horário de atendimento",
  "identificacao-contatos.endereco": "Localização",
  "identificacao-contatos.instagram": "Instagram",
  "identificacao-contatos.facebook": "Facebook",
  "identificacao-contatos.linkedin": "LinkedIn",
  "identificacao-contatos.youtube": "YouTube",
  "identificacao-contatos.outras-redes": "Outras redes ou links",

  // bloco 2 — identidade visual
  "identidade-visual.cores-anexos": "Manual de marca / paleta",
  "identidade-visual.cores-descricao": "Descrição das cores",
  "identidade-visual.cor-proibida": "Existe cor a evitar?",
  "identidade-visual.cor-proibida-qual": "Qual cor evitar",
  "identidade-visual.dinamica-cores": "Dinâmica de cores na página",
  "identidade-visual.fonte-nome": "Nome da fonte",
  "identidade-visual.fonte-arquivos": "Arquivos da fonte",
  "identidade-visual.estilo-tipografico": "Estilo tipográfico",
  "identidade-visual.tem-fotos": "Tem fotos profissionais?",
  "identidade-visual.fotos": "Fotos profissionais",

  // bloco 3 — linguagem e tom
  "linguagem-tom.acessivel-premium": "Acessível ↔ Premium",
  "linguagem-tom.moderno-conservador": "Moderno ↔ Conservador",
  "linguagem-tom.clean-informacao": "Clean ↔ Mais informação",
  "linguagem-tom.humano-tecnico": "Humano ↔ Técnico",
  "linguagem-tom.descontraido-reservado": "Descontraído ↔ Reservado",

  // bloco 4 — referências e concorrência
  "referencias-concorrencia.referencias": "Referências visuais",
  "referencias-concorrencia.concorrentes": "Concorrentes",
  "referencias-concorrencia.banner-arquivos": "Imagens de referência para o banner",
  "referencias-concorrencia.banner-links": "Links de referência para o banner",
  "referencias-concorrencia.site-arquivos": "Arquivos de referência para o site",
  "referencias-concorrencia.site-links": "Links de referência para o site",
  "referencias-concorrencia.trafego-pago": "Faz uso de tráfego pago?",
  "referencias-concorrencia.especialidades": "Especialidades / serviços oferecidos",
  "referencias-concorrencia.ter-menu": "Site terá menu?",
  "referencias-concorrencia.banner-estilo": "Estilo de banner",

  // bloco 5a — briefing de copy
  "briefing-copy.dores": "Dores e dificuldades da persona",
  "briefing-copy.sonhos": "Maiores sonhos da persona",
  "briefing-copy.objecoes": "Objeções",
  "briefing-copy.jornada": "Etapa da jornada de conversão",
  "briefing-copy.o-que-entregue": "O que é entregue",
  "briefing-copy.diferenciais": "Diferenciais",
  "briefing-copy.faqs": "Dúvidas e respostas frequentes",
  "briefing-copy.link-curriculo": "Link do currículo",
  "briefing-copy.midia": "Participações na mídia",
  "briefing-copy.especialidade-nomes": "Nome da especialidade (e variações)",
  "briefing-copy.como-funciona": "Como funciona o atendimento",
  "briefing-copy.palavras-chave": "Palavras-chave principais",
  "briefing-copy.palavras-auxiliares": "Palavras-chave auxiliares",
  "briefing-copy.link-google": "Link do Google Meu Negócio",
  "briefing-copy.prints-depoimentos": "Prints de depoimentos",
  "briefing-copy.depoimentos-texto": "Depoimentos por escrito",

  // bloco 5b — textos prontos
  "textos-prontos.arquivos": "Arquivos com os textos",
  "textos-prontos.link-docs": "Link do Google Docs",
  "textos-prontos.observacoes": "Observações sobre os textos",
};

/**
 * Para campos categóricos (radio/select), mapeia o slug salvo
 * para a label humana exibida originalmente.
 */
export const VALUE_LABELS: Record<string, Record<string, string>> = {
  // Linguagem e tom — escala 3 pontos
  "linguagem-tom.acessivel-premium": {
    esquerda: "Acessível",
    meio: "Meio termo",
    direita: "Premium",
  },
  "linguagem-tom.moderno-conservador": {
    esquerda: "Moderno",
    meio: "Meio termo",
    direita: "Conservador",
  },
  "linguagem-tom.clean-informacao": {
    esquerda: "Clean / minimalista",
    meio: "Meio termo",
    direita: "Mais informação visual",
  },
  "linguagem-tom.humano-tecnico": {
    esquerda: "Humano",
    meio: "Meio termo",
    direita: "Técnico",
  },
  "linguagem-tom.descontraido-reservado": {
    esquerda: "Descontraído",
    meio: "Meio termo",
    direita: "Reservado",
  },

  // Identidade visual
  "identidade-visual.cor-proibida": { sim: "Sim", nao: "Não" },
  "identidade-visual.dinamica-cores": {
    "fundo-escuro": "Fundo escuro único",
    "fundo-claro": "Fundo claro único",
    intercalar: "Intercalar cores entre blocos",
  },
  "identidade-visual.estilo-tipografico": {
    "serifada-titulos": "Serifada nos títulos",
    "nao-serifada-textos": "Não serifada nos textos",
    "sem-serifada": "Não usar serifadas",
  },
  "identidade-visual.tem-fotos": { sim: "Sim", nao: "Não" },

  // Referências
  "referencias-concorrencia.trafego-pago": {
    sim: "Sim",
    nao: "Não",
    "ainda-nao": "Ainda não, mas pretende",
  },
  "referencias-concorrencia.ter-menu": {
    sim: "Sim",
    nao: "Não",
    "nao-sei": "A definir com a equipe",
  },
  "referencias-concorrencia.banner-estilo": {
    "imagem-propria": "Imagem própria profissional",
    "imagem-mais-ilustracoes": "Imagem própria + ilustrações",
    "banco-imagens": "Imagem de banco",
  },

  // Copy
  "briefing-copy.jornada": {
    identificacao: "Identificação do problema",
    comparando: "Comparando soluções",
    pronto: "Pronto para comprar",
    outro: "Outro (alinhar na call)",
  },
};

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  "landing-com-copy": "Landing Page com copy",
  "landing-sem-copy": "Landing Page sem copy",
  "site-completo": "Site completo",
};

export const BLOCO_LABELS: Record<string, string> = {
  "identificacao-contatos": "Identificação e contatos",
  "identidade-visual": "Identidade visual",
  "linguagem-tom": "Linguagem e tom da marca",
  "referencias-concorrencia": "Referências e concorrência",
  "briefing-copy": "Briefing de copy",
  "textos-prontos": "Textos prontos",
};

export const BLOCO_NUMBERS: Record<string, number> = {
  "identificacao-contatos": 1,
  "identidade-visual": 2,
  "linguagem-tom": 3,
  "referencias-concorrencia": 4,
  "briefing-copy": 5,
  "textos-prontos": 5,
};

/**
 * Resolve label humana de um campo. Aceita field-id curto OU completo.
 */
export function fieldLabel(fieldIdOrFull: string): string {
  if (FIELD_LABELS[fieldIdOrFull]) return FIELD_LABELS[fieldIdOrFull];
  // tenta só o último segmento (compatível com chaves curtas tipo "horario")
  const segments = fieldIdOrFull.split(".");
  const short = segments[segments.length - 1];
  return short.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Resolve valor humano para campos categóricos.
 */
export function valueLabel(fullFieldId: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const map = VALUE_LABELS[fullFieldId];
  return map?.[value] ?? null;
}

/**
 * Determina se um campo guarda upload(s) — formato `[{ url, path, name, size, mimeType }]`.
 */
export function isFileField(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const first = value[0] as Record<string, unknown>;
  return (
    typeof first === "object" &&
    first !== null &&
    "url" in first &&
    "path" in first &&
    "name" in first
  );
}

/**
 * Determina se um valor é considerado "vazio" (deve ser ocultado da renderização).
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    // arrays de objetos com todos campos vazios também contam
    return value.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      return Object.values(item as Record<string, unknown>).every((v) =>
        typeof v === "string" ? v.trim().length === 0 : v == null
      );
    });
  }
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}
