import { normalizar } from "./briefing-match";
import { DEFAULT_PROJECT_TASKS } from "./project-tasks";
import type { ProjectType } from "./types";

/**
 * Projeto INCOMPLETO — o que falta pra um projeto poder ser tocado.
 *
 * Por que isso existe (Karine, 2026-09-22): "está um conflito entre aqueles
 * projetos que vêm do ClickUp e os que são do app que o cliente preenche...
 * os que são do app mesmo vêm sem os dados ali e não têm o modelo de tarefas
 * criado". Na prática o app não guarda de onde o projeto veio (não existe
 * coluna de origem em `clients`), e a falha não é exclusiva de uma origem:
 * o que dá pra afirmar com certeza é o que FALTA em cada projeto.
 *
 * Dois buracos, os dois verificáveis sem adivinhação:
 *   1. sem `project_type` — sem ele não há timeline nem modelo de tarefas;
 *   2. sem checklist — nenhuma tarefa em `project_tasks`, ou tão poucas que
 *      o modelo claramente nunca foi gerado.
 *
 * Nada aqui corrige nada sozinho: só descreve. Quem manda gerar é a equipe,
 * na tela (pedido explícito: "ter a opção de ajustar isso").
 */

export const PROJECT_TYPE_VALUES: ProjectType[] = [
  "landing-com-copy",
  "landing-sem-copy",
  "site-completo",
  "seo",
  "outro",
];

export function ehProjectType(valor: string): valor is ProjectType {
  return (PROJECT_TYPE_VALUES as string[]).includes(valor);
}

/**
 * Etapa canônica de um título de tarefa.
 *
 * O ClickUp batiza a mesma etapa com o nome do cliente junto ("Copy LP
 * Laurence", "Design LP Danielle", "Ajustes Sofia Rito v2"), então comparar
 * título com título acharia que a etapa não existe e criaria uma segunda
 * igual. Mesmo espírito (e mesmos prefixos) de `donoPadraoDe()` em
 * project-tasks.ts.
 *
 * Usado só pra DEDUPLICAR na hora de gerar — errar pro lado de "já existe"
 * custa uma tarefa a menos, que dá pra adicionar na mão; errar pro outro
 * lado enche o projeto de tarefa repetida.
 */
export function etapaDaTarefa(titulo: string): string {
  const n = normalizar(titulo);
  if (!n) return "";
  if (n.startsWith("envio contrato") || n.startsWith("contrato")) return "contrato";
  if (n.startsWith("pagamento")) return "pagamento";
  if (n.startsWith("copy")) return "copy";
  if (n.startsWith("informacoes iniciais")) return "informacoes-iniciais";
  if (n.startsWith("ajustes")) {
    // "Ajustes v2", "Ajustes Sofia Rito v2" → mesma leva. Sem número = v1.
    const leva = n.match(/\bv\s?(\d+)\b/);
    return `ajustes-v${leva ? leva[1] : "1"}`;
  }
  if (n.startsWith("criacao assets") || n.startsWith("assets") || n.startsWith("bgs"))
    return "assets";
  if (n.startsWith("design")) return "design";
  if (n.startsWith("implementa")) return "implementacao";
  if (n.startsWith("auditoria")) return "auditoria";
  if (n.startsWith("estrategia")) return "estrategia";
  // Antes da regra de "otimiza" genérica abaixo: no modelo de SEO a
  // otimização on-page é uma etapa própria, não a entrega final.
  if (n.startsWith("otimizacao on page") || n.startsWith("otimizacao onpage"))
    return "otimizacao-on-page";
  if (n.startsWith("conteudo")) return "conteudo";
  if (n.startsWith("relatorio")) return "relatorio";
  if (n.startsWith("planejamento")) return "planejamento";
  if (n.startsWith("execucao")) return "execucao";
  if (n.startsWith("entrega")) return "entrega";
  if (/^dep\b/.test(n) || n.startsWith("otimiza")) return "dep";
  return n;
}

/**
 * Títulos do modelo que o projeto ainda NÃO tem (comparando por etapa, não
 * por texto). Devolve na ordem do modelo.
 */
export function tarefasFaltando(
  projectType: ProjectType,
  titulosExistentes: string[]
): string[] {
  const jaTem = new Set(titulosExistentes.map(etapaDaTarefa));
  const vistas = new Set<string>();
  return (DEFAULT_PROJECT_TASKS[projectType] ?? []).filter((titulo) => {
    const etapa = etapaDaTarefa(titulo);
    if (jaTem.has(etapa) || vistas.has(etapa)) return false;
    vistas.add(etapa);
    return true;
  });
}

/** Quantas tarefas o modelo daquele tipo tem. 0 = tipo indefinido. */
export function tamanhoDoModelo(projectType: ProjectType | null): number {
  if (!projectType) return 0;
  return DEFAULT_PROJECT_TASKS[projectType]?.length ?? 0;
}

export interface PendenciasProjeto {
  /** Sem tipo de projeto — a coluna TIPO aparece como "—" na Lista. */
  semTipo: boolean;
  /** Nenhuma tarefa gerada. */
  semChecklist: boolean;
  /**
   * Tem tarefa, mas menos da metade do modelo — sinal de que só vieram as
   * poucas que o sync do ClickUp trouxe e o checklist nunca foi gerado.
   * Limite conservador de propósito: projeto com 10 de 11 não é problema,
   * é um modelo com uma etapa a menos.
   */
  checklistParcial: boolean;
  totalTarefas: number;
  tamanhoModelo: number;
}

export function pendenciasDoProjeto(projeto: {
  projectType: ProjectType | null;
  totalTarefas: number;
}): PendenciasProjeto {
  const tamanhoModelo = tamanhoDoModelo(projeto.projectType);
  const totalTarefas = Math.max(0, projeto.totalTarefas);
  return {
    semTipo: !projeto.projectType,
    semChecklist: totalTarefas === 0,
    checklistParcial:
      totalTarefas > 0 && tamanhoModelo > 0 && totalTarefas * 2 < tamanhoModelo,
    totalTarefas,
    tamanhoModelo,
  };
}

export function projetoIncompleto(p: PendenciasProjeto): boolean {
  return p.semTipo || p.semChecklist || p.checklistParcial;
}

/**
 * Retorno da Server Action que ajusta um projeto. Mora aqui (e não no
 * arquivo "use server") porque um módulo de Server Actions só pode exportar
 * função async — constante e interface precisam vir de fora.
 */
export interface AjusteProjetoState {
  /** null = nada enviado ainda (estado inicial do useActionState). */
  ok: boolean | null;
  mensagem: string;
  /** Qual projeto a mensagem descreve — a tela só mostra na linha certa. */
  clientId: string | null;
}

export const AJUSTE_INICIAL: AjusteProjetoState = {
  ok: null,
  mensagem: "",
  clientId: null,
};

/** Rótulos curtos do que falta — viram as pílulas da tela. */
export function faltasEmTexto(p: PendenciasProjeto): string[] {
  const faltas: string[] = [];
  if (p.semTipo) faltas.push("sem tipo de projeto");
  if (p.semChecklist) faltas.push("sem checklist de tarefas");
  else if (p.checklistParcial) {
    faltas.push(
      `checklist parcial (${p.totalTarefas} de ${p.tamanhoModelo} do modelo)`
    );
  }
  return faltas;
}
