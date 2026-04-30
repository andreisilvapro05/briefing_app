import { getServerEnv } from "./env";
import type { Cliente } from "./types";
import {
  BLOCO_LABELS,
  BLOCO_NUMBERS,
  PROJECT_TYPE_LABELS,
  fieldLabel,
  isEmpty,
  isFileField,
  valueLabel,
} from "./briefing-labels";

/**
 * Cria a tarefa do briefing na lista correta do ClickUp.
 * https://clickup.com/api/clickupreference/operation/CreateTask/
 */

interface CreateTaskInput {
  cliente: Cliente;
  responses: Record<string, unknown>;
  publicLinkParaPainelAdmin?: string;
  filesCount?: number;
}

export async function createClickUpBriefingTask(
  input: CreateTaskInput
): Promise<{ taskId?: string; skipped?: boolean; reason?: string }> {
  const env = getServerEnv();

  if (!env.clickupToken || !env.clickupListId) {
    return {
      skipped: true,
      reason: "ClickUp não configurado (CLICKUP_API_TOKEN ou CLICKUP_LIST_ID).",
    };
  }

  const description = renderMarkdown(input);

  // Sem status explícito → ClickUp usa o default da lista (evita 400 quando
  // o nome do status custom não bate com "to do").
  const res = await fetch(
    `https://api.clickup.com/api/v2/list/${env.clickupListId}/task`,
    {
      method: "POST",
      headers: {
        Authorization: env.clickupToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Briefing · ${input.cliente.empresa}`,
        markdown_description: description,
        priority: 2,
        tags: ["briefing", input.cliente.projectType ?? "indefinido"],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return { taskId: data.id };
}

// ============================================================
// Renderização Markdown
// ============================================================

function renderMarkdown(input: CreateTaskInput): string {
  const { cliente, responses, publicLinkParaPainelAdmin, filesCount } = input;
  const lines: string[] = [];

  // Header
  lines.push(`# ${cliente.empresa}`);
  lines.push("");
  lines.push(`> **Cliente** · ${cliente.nome}  `);
  lines.push(`> **E-mail** · ${cliente.email}  `);
  lines.push(`> **WhatsApp** · ${cliente.whatsapp}  `);
  if (cliente.projectType) {
    lines.push(
      `> **Tipo de projeto** · ${PROJECT_TYPE_LABELS[cliente.projectType] ?? cliente.projectType}`
    );
  }
  lines.push("");

  if (filesCount !== undefined && filesCount > 0) {
    lines.push(
      `📎 **${filesCount} arquivo${filesCount > 1 ? "s anexados" : " anexado"}** — visualizar no painel admin`
    );
    lines.push("");
  }

  if (publicLinkParaPainelAdmin) {
    lines.push(`🔗 [Abrir no painel admin](${publicLinkParaPainelAdmin})`);
    lines.push("");
  }

  // Agrupa respostas por bloco
  const byBloco = new Map<string, Array<[string, unknown]>>();
  for (const [key, value] of Object.entries(responses)) {
    if (isEmpty(value)) continue;
    const [bloco, ...rest] = key.split(".");
    const fieldId = rest.join(".");
    const list = byBloco.get(bloco) ?? [];
    list.push([fieldId, value]);
    byBloco.set(bloco, list);
  }

  // Ordena blocos pela numeração
  const ordered = Array.from(byBloco.entries()).sort((a, b) => {
    const numA = BLOCO_NUMBERS[a[0]] ?? 99;
    const numB = BLOCO_NUMBERS[b[0]] ?? 99;
    return numA - numB;
  });

  for (const [blocoId, fields] of ordered) {
    const numero = BLOCO_NUMBERS[blocoId] ?? 0;
    const titulo = BLOCO_LABELS[blocoId] ?? blocoId;

    lines.push("---");
    lines.push("");
    lines.push(`## ${String(numero).padStart(2, "0")} · ${titulo}`);
    lines.push("");

    // Linguagem e tom — tabela visual em vez de lista
    if (blocoId === "linguagem-tom") {
      lines.push("| Eixo | Posicionamento |");
      lines.push("|---|---|");
      for (const [fieldId, value] of fields) {
        const fullId = `${blocoId}.${fieldId}`;
        const label = fieldLabel(fullId);
        const human = valueLabel(fullId, value) ?? String(value);
        lines.push(`| ${label} | **${human}** |`);
      }
      lines.push("");
      continue;
    }

    for (const [fieldId, value] of fields) {
      const fullId = `${blocoId}.${fieldId}`;
      const label = fieldLabel(fullId);
      lines.push(`**${label}**  `);
      lines.push(formatValue(fullId, value));
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(`_Briefing gerado automaticamente pelo Fysi Briefing App._`);

  return lines.join("\n");
}

/**
 * Formata um valor para markdown legível.
 */
function formatValue(fullFieldId: string, value: unknown): string {
  // Categórico → label humana
  const human = valueLabel(fullFieldId, value);
  if (human) return human;

  // Upload(s)
  if (isFileField(value)) {
    const files = value as Array<{
      name: string;
      url: string;
      size: number;
    }>;
    return files
      .map((f) => `- 📁 [${f.name}](${f.url}) · ${humanSize(f.size)}`)
      .join("\n");
  }

  // String
  if (typeof value === "string") {
    return value.trim();
  }

  // Lista de strings (tags / palavras-chave)
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return (value as string[]).map((s) => `\`${s}\``).join(" · ");
  }

  // Lista de objetos — repetidores (referências, FAQs, depoimentos, etc.)
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
    return (value as Array<Record<string, unknown>>)
      .map((item, idx) => {
        const entries = Object.entries(item).filter(
          ([, v]) => v !== null && v !== "" && v !== undefined
        );
        if (!entries.length) return null;
        const inline = entries
          .map(([k, v]) => `**${humanizeKey(k)}:** ${truncate(String(v), 200)}`)
          .join(" · ");
        return `- _${idx + 1}._ ${inline}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  // Boolean / number / fallback
  if (value === null || value === undefined) return "_(vazio)_";
  if (typeof value === "object") {
    return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
  }
  return String(value);
}

function humanizeKey(k: string): string {
  const map: Record<string, string> = {
    p: "Pergunta",
    r: "Resposta",
    url: "Link",
    nome: "Nome",
    motivo: "O que gostou",
    descricao: "Descrição",
    autor: "Autor",
    texto: "Depoimento",
  };
  return (
    map[k] ??
    k.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function humanSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
