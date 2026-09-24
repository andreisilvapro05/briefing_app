import { TEAM_MEMBERS, isClosedTaskStatus, type TaskStatus } from "./project-tasks";
import type { ViewTabItem } from "@/components/admin/view-tabs";

/**
 * As abas por pessoa das duas telas que mostram projetos agrupados por
 * status (Visão Geral e Lista). O número é de PROJETOS, não de tarefas —
 * é o que a "Lista Valéria" do ClickUp mostra.
 *
 * Só conta tarefa com PRAZO: sem esse corte, as etapas futuras do checklist
 * (que ninguém agendou) faziam toda pessoa parecer estar em todo projeto.
 */
export function abasPorPessoa(
  tarefas: { client_id: string | null; responsavel: string | null; status: string; data_vencimento: string | null }[],
  base: string,
  keyParam: string,
  ativo: string
): ViewTabItem[] {
  const abertas = tarefas.filter(
    (t) => t.client_id && t.data_vencimento && !isClosedTaskStatus(t.status as TaskStatus)
  );
  const projetosDe = (pessoa: string) =>
    new Set(
      abertas.filter((t) => t.responsavel === pessoa).map((t) => t.client_id as string)
    );

  const out: ViewTabItem[] = [
    {
      value: "",
      label: "Todos",
      count: new Set(abertas.map((t) => t.client_id as string)).size,
      href: `${base}${keyParam}`,
    },
  ];
  for (const m of TEAM_MEMBERS) {
    const count = projetosDe(m.value).size;
    // Pessoa sem projeto em aberto não vira aba — a barra mostra quem está
    // com trabalho agora, não o quadro de funcionários.
    if (count === 0 && ativo !== m.value) continue;
    const sep = keyParam ? "&" : "?";
    out.push({
      value: m.value,
      label: m.label,
      iniciais: m.iniciais,
      cor: m.cor,
      count,
      href: `${base}${keyParam}${sep}resp=${encodeURIComponent(m.value)}`,
    });
  }
  return out;
}

/** Os clientes em que a pessoa tem tarefa com prazo em aberto. */
export function projetosDaPessoa(
  tarefas: { client_id: string | null; responsavel: string | null; status: string; data_vencimento: string | null }[],
  pessoa: string
): Set<string> {
  return new Set(
    tarefas
      .filter(
        (t) =>
          t.client_id &&
          t.data_vencimento &&
          !isClosedTaskStatus(t.status as TaskStatus) &&
          t.responsavel === pessoa
      )
      .map((t) => t.client_id as string)
  );
}
