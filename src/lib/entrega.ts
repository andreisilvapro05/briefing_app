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
}

export function emptyEntrega(): EntregaDocumento {
  return {
    acessos: [emptyAcesso("WordPress")],
    tutoriais: [],
    backups: [],
    documentacao: "",
    garantia:
      "Garantia de 30 dias para correção de bugs e ajustes funcionais. " +
      "Em caso de dúvida, fala com a gente pelo WhatsApp do contrato.",
    mensagemFinal: "",
  };
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
  const checks: boolean[] = [
    doc.acessos.some((a) => a.nome.trim() && a.usuario.trim()),
    doc.tutoriais.some((t) => t.titulo.trim()),
    doc.backups.some((b) => b.titulo.trim()),
    doc.documentacao.trim().length > 0,
    doc.garantia.trim().length > 0,
    doc.mensagemFinal.trim().length > 0,
  ];
  const total = checks.length;
  const preenchidos = checks.filter(Boolean).length;
  return { total, preenchidos, pct: Math.round((preenchidos / total) * 100) };
}
