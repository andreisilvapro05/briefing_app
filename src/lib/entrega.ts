/**
 * Documento de Entrega — pacote final que o cliente recebe ao fim do projeto.
 *
 * Estrutura jsonb em `clients.entrega_documento`. Visível pro cliente quando
 * o admin marca como finalizada (entrega_finalizada_at preenchido).
 */

export interface AcessoItem {
  /** Nome do sistema (WordPress, cPanel, Registro.br, etc) */
  nome: string;
  /** URL pra acessar */
  url: string;
  /** Usuário/login */
  usuario: string;
  /** Senha (em texto claro — admin é responsável por compartilhar com segurança) */
  senha: string;
  /** Anotações livres */
  notas: string;
}

export interface TutorialItem {
  titulo: string;
  /** Link pra vídeo, Drive, Loom, YouTube, ou texto livre */
  url: string;
  descricao: string;
}

export interface BackupItem {
  titulo: string;
  url: string;
  /** Data de quando o backup foi feito (ISO ou texto) */
  data: string;
}

export interface EntregaDocumento {
  acessos: AcessoItem[];
  tutoriais: TutorialItem[];
  backups: BackupItem[];
  /** Markdown livre — documentação técnica do projeto */
  documentacao: string;
  /** Texto da garantia (prazo, escopo, contato) */
  garantia: string;
  /** Mensagem personalizada da equipe pro cliente */
  mensagemFinal: string;

  // ── Campos adicionados pra cobrir o template DEP completo da Fysi ──
  // Todos opcionais — entregas antigas continuam funcionando sem nenhum
  // desses preenchidos.

  /** Programa "Indique e Ganhe" (R$ 250 padrão). */
  referral?: ReferralSection;

  /** URL do formulário de satisfação (Google Forms, Typeform, etc). */
  npsUrl?: string;

  /** 5 checklists: segurança, backup, obrigatório, SEO, cliente. */
  checklists?: ChecklistsSection;

  /** Dump do "Site Health" do WordPress pra rastreabilidade técnica. */
  relatorioTecnico?: string;

  /** Domínio cadastrado pelo CLIENTE no painel dele. */
  clienteDominio?: string;
  /** Hospedagem cadastrada pelo CLIENTE. */
  clienteHospedagem?: string;
  /** Timestamp da última edição dos campos do cliente. */
  clienteAtualizadoAt?: string | null;
}

export interface ReferralSection {
  ativo: boolean;
  valor: string;
  /** Texto livre da condição/regra. */
  condicoes: string;
}

export interface ChecklistItem {
  /** Pergunta/item (ex: "Certificado SSL"). */
  label: string;
  /** Resposta livre (ex: "Ativo", "Sim", "Após 5 tentativas", etc). */
  valor: string;
}

export interface ChecklistsSection {
  seguranca: ChecklistItem[];
  backup: ChecklistItem[];
  obrigatorio: ChecklistItem[];
  seo: ChecklistItem[];
  cliente: ChecklistItem[];
}

export function emptyEntrega(): EntregaDocumento {
  return {
    acessos: [emptyAcesso("WordPress")],
    tutoriais: defaultTutoriais(),
    backups: [],
    documentacao: "",
    garantia:
      "Garantia de 30 dias para correção de bugs e ajustes funcionais. " +
      "Em caso de dúvida, fala com a gente pelo WhatsApp do contrato.",
    mensagemFinal:
      "Aqui está o seu Documento de Entrega de Projeto. Nele está tudo o " +
      "que você precisa saber do seu projeto, assim como os acessos ao " +
      "seu site. Guarde com carinho ok? 💚",
    referral: defaultReferral(),
    npsUrl: "",
    checklists: defaultChecklists(),
    relatorioTecnico: "",
    clienteDominio: "",
    clienteHospedagem: "",
    clienteAtualizadoAt: null,
  };
}

/** Templates pré-prontos dos 7 tutoriais clássicos da Fysi. */
export function defaultTutoriais(): TutorialItem[] {
  return [
    {
      titulo: "Como fazer Backup",
      url: "https://www.youtube.com/EoWXY72nhzs&t",
      descricao:
        "Antes de qualquer alteração faça um backup. Painel → All-in-One WP Migration → Exportar → Ficheiro.",
    },
    {
      titulo: "Acesso ao painel de edição",
      url: "https://youtu.be/bDHt_krQHyE",
      descricao:
        "Painel → Páginas → passe o mouse na página → Editar com o Elementor.",
    },
    {
      titulo: "Como editar textos",
      url: "",
      descricao:
        "Clique no texto, edite pelo painel lateral, clique em Publicar/Atualizar.",
    },
    {
      titulo: "Como editar imagens",
      url: "",
      descricao:
        "Clique na imagem → barra lateral → Escolher imagem. Mantenha o mesmo tamanho original.",
    },
    {
      titulo: "Extra — Otimizar imagens",
      url: "https://youtu.be/OcjtUu_Gv6c",
      descricao:
        "Ideal manter o peso da imagem entre 150–200kb. Use https://squoosh.app/ ou https://tinypng.com/.",
    },
    {
      titulo: "Adicionar posts",
      url: "https://youtu.be/q9xpjfSyqt0",
      descricao:
        "Lateral → Artigos → Adicionar novo → preencha título, conteúdo, categoria, descrição e SEO.",
    },
    {
      titulo: "IMPORTANTE — Como limpar cache e evitar erros",
      url: "",
      descricao:
        "Depois de qualquer alteração: Opções → WP Rocket → Limpar e Pré-carregar cache.",
    },
  ];
}

export function defaultReferral(): ReferralSection {
  return {
    ativo: true,
    valor: "R$ 250,00",
    condicoes:
      "A cada vez que você indicar a Fysi e essa pessoa ou empresa fechar conosco, ganhe R$ 250,00 no Pix imediatamente.",
  };
}

export function defaultChecklists(): ChecklistsSection {
  return {
    seguranca: [
      { label: "Plugin de Segurança", valor: "All In One WP Security" },
      { label: "Setup força bruta", valor: "Sim" },
      { label: "Bloqueio de usuários desconhecidos", valor: "Após 5 tentativas" },
      { label: "Certificado SSL", valor: "Ativo" },
      { label: "Desabilitar escrita de PHP nos Uploads", valor: "Sim" },
      { label: "Ajustes de permissão de arquivos", valor: "Sim" },
      { label: "Setup contra spam", valor: "Sim" },
      { label: "Habilitar atualização automática", valor: "Sim" },
      { label: "Alteração de usuário admin", valor: "Sim" },
    ],
    backup: [
      { label: "Plugin de backup", valor: "Sim" },
      { label: "Local de armazenamento backup", valor: "Pasta" },
      { label: "Frequência dos backups", valor: "Manual" },
    ],
    obrigatorio: [
      { label: "Google Analytics", valor: "Sim" },
      { label: "Plugin de SEO", valor: "Rank Math" },
      { label: "Formulário de contato está funcionando?", valor: "Sim" },
      { label: "Todos os Links estão funcionando?", valor: "Sim" },
      { label: "Título e descrição estão corretos?", valor: "Sim" },
      { label: "Imagem de compartilhamento está correta?", valor: "Sim" },
      { label: "O Favicon está aparecendo?", valor: "Sim" },
      { label: "O logo está direcionando para a Home?", valor: "Sim" },
    ],
    seo: [
      { label: "Google Search Console foi ativado?", valor: "Sim" },
      { label: "Os títulos das páginas estão corretos?", valor: "Sim" },
      { label: "O Sitemap XML está funcionando?", valor: "Sim" },
      { label: "Os conteúdos de exemplo foram apagados?", valor: "Sim" },
      {
        label: "Posts, páginas e produtos estão sendo indexados corretamente?",
        valor: "Sim",
      },
      { label: "Post types desnecessários sendo indexados?", valor: "Não" },
      {
        label: "URLs amigáveis estão configuradas corretamente?",
        valor: "Sim",
      },
      { label: "Ajustou os links permanentes?", valor: "Sim" },
    ],
    cliente: [{ label: "Projeto validado pelo cliente", valor: "Sim" }],
  };
}

export function emptyChecklistItem(): ChecklistItem {
  return { label: "", valor: "" };
}

export function emptyAcesso(nome: string = ""): AcessoItem {
  return {
    nome,
    url: "",
    usuario: "",
    senha: "",
    notas: "",
  };
}

export function emptyTutorial(): TutorialItem {
  return { titulo: "", url: "", descricao: "" };
}

export function emptyBackup(): BackupItem {
  return { titulo: "", url: "", data: "" };
}

/**
 * Renderiza o documento como Markdown — pra copiar/enviar/baixar.
 */
export function renderEntregaMarkdown(
  doc: EntregaDocumento,
  meta?: { clientName?: string; empresa?: string; entregueEm?: string | null }
): string {
  const lines: string[] = [];
  const titulo = meta?.empresa || meta?.clientName || "Cliente";
  lines.push(`# 🎁 Documento de Entrega — ${titulo}`);
  if (meta?.entregueEm) {
    lines.push("");
    lines.push(`Entregue em ${meta.entregueEm}`);
  }
  lines.push("");

  if (doc.mensagemFinal.trim()) {
    lines.push(doc.mensagemFinal.trim());
    lines.push("");
  }

  if (doc.acessos.length > 0 && doc.acessos.some((a) => a.nome.trim())) {
    lines.push("## 🔐 Acessos");
    lines.push("");
    doc.acessos
      .filter((a) => a.nome.trim())
      .forEach((a) => {
        lines.push(`### ${a.nome}`);
        if (a.url) lines.push(`- **URL:** ${a.url}`);
        if (a.usuario) lines.push(`- **Usuário:** ${a.usuario}`);
        if (a.senha) lines.push(`- **Senha:** \`${a.senha}\``);
        if (a.notas) lines.push(`- **Notas:** ${a.notas}`);
        lines.push("");
      });
  }

  if (doc.tutoriais.length > 0 && doc.tutoriais.some((t) => t.titulo.trim())) {
    lines.push("## 📺 Tutoriais");
    lines.push("");
    doc.tutoriais
      .filter((t) => t.titulo.trim())
      .forEach((t) => {
        lines.push(`- **${t.titulo}** — ${t.url}`);
        if (t.descricao) lines.push(`  - ${t.descricao}`);
      });
    lines.push("");
  }

  if (doc.backups.length > 0 && doc.backups.some((b) => b.titulo.trim())) {
    lines.push("## 💾 Backups");
    lines.push("");
    doc.backups
      .filter((b) => b.titulo.trim())
      .forEach((b) => {
        lines.push(`- **${b.titulo}** (${b.data || "—"}) — ${b.url}`);
      });
    lines.push("");
  }

  if (doc.documentacao.trim()) {
    lines.push("## 📄 Documentação técnica");
    lines.push("");
    lines.push(doc.documentacao.trim());
    lines.push("");
  }

  if (doc.garantia.trim()) {
    lines.push("## 🛡️ Garantia");
    lines.push("");
    lines.push(doc.garantia.trim());
    lines.push("");
  }

  // Indique e ganhe
  if (doc.referral?.ativo && doc.referral.valor.trim()) {
    lines.push("## 🎁 Bora de bônus? Indique e ganhe!");
    lines.push("");
    lines.push(`**Valor:** ${doc.referral.valor}`);
    if (doc.referral.condicoes) {
      lines.push("");
      lines.push(doc.referral.condicoes);
    }
    lines.push("");
  }

  // NPS
  if (doc.npsUrl?.trim()) {
    lines.push("## 📝 Pesquisa de satisfação");
    lines.push("");
    lines.push(`Conta pra gente como foi: ${doc.npsUrl}`);
    lines.push("");
  }

  // Checklists
  if (doc.checklists) {
    const groups: Array<{ titulo: string; items: ChecklistItem[] }> = [
      { titulo: "🔒 Checklist de segurança", items: doc.checklists.seguranca },
      { titulo: "💾 Checklist de backup", items: doc.checklists.backup },
      { titulo: "✅ Checklist obrigatório", items: doc.checklists.obrigatorio },
      { titulo: "🔍 Checklist de SEO", items: doc.checklists.seo },
      { titulo: "👤 Checklist do cliente", items: doc.checklists.cliente },
    ];
    groups.forEach((g) => {
      const valid = g.items.filter((i) => i.label.trim());
      if (valid.length === 0) return;
      lines.push(`## ${g.titulo}`);
      lines.push("");
      valid.forEach((i) => {
        lines.push(`- **${i.label}:** ${i.valor || "—"}`);
      });
      lines.push("");
    });
  }

  // Cliente preencheu domínio/hospedagem
  if (doc.clienteDominio?.trim() || doc.clienteHospedagem?.trim()) {
    lines.push("## 🌐 Domínio e hospedagem");
    lines.push("");
    if (doc.clienteDominio?.trim()) {
      lines.push(`- **Domínio:** ${doc.clienteDominio}`);
    }
    if (doc.clienteHospedagem?.trim()) {
      lines.push(`- **Hospedagem:** ${doc.clienteHospedagem}`);
    }
    lines.push("");
  }

  // Relatório técnico
  if (doc.relatorioTecnico?.trim()) {
    lines.push("## 🔧 Relatório técnico");
    lines.push("");
    lines.push("```");
    lines.push(doc.relatorioTecnico);
    lines.push("```");
    lines.push("");
  }

  lines.push("---");
  lines.push("Fysi Lab · obrigado pela confiança 💚");

  return lines.join("\n");
}

/**
 * Conta quantos campos foram preenchidos — pra mostrar % de completude
 * no admin antes de marcar como entregue.
 */
export function entregaCompletude(doc: EntregaDocumento): {
  total: number;
  preenchidos: number;
  pct: number;
} {
  const cks = doc.checklists;
  const checks: boolean[] = [
    doc.mensagemFinal.trim().length > 0,
    doc.acessos.some((a) => a.nome.trim() && a.usuario.trim()),
    doc.tutoriais.some((t) => t.titulo.trim()),
    doc.backups.some((b) => b.titulo.trim()),
    doc.garantia.trim().length > 0,
    !!doc.referral?.ativo && (doc.referral?.valor?.trim().length ?? 0) > 0,
    (doc.npsUrl?.trim().length ?? 0) > 0,
    !!cks?.seguranca?.some((i) => i.label.trim() && i.valor.trim()),
    !!cks?.backup?.some((i) => i.label.trim() && i.valor.trim()),
    !!cks?.obrigatorio?.some((i) => i.label.trim() && i.valor.trim()),
    !!cks?.seo?.some((i) => i.label.trim() && i.valor.trim()),
    (doc.relatorioTecnico?.trim().length ?? 0) > 0,
  ];
  const total = checks.length;
  const preenchidos = checks.filter(Boolean).length;
  return { total, preenchidos, pct: Math.round((preenchidos / total) * 100) };
}
