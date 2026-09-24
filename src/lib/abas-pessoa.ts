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

/**
 * Aba do trabalho que tem prazo e não tem dono. Não é membro da equipe, por
 * isso o valor não pode colidir com nenhum `TEAM_MEMBERS[].value`.
 *
 * Sem ela esse trabalho ficava invisível: aparecia em "Todos" e em nenhuma
 * aba de pessoa, então ninguém que abrisse o próprio recorte via que havia
 * projeto com data marcada e sem responsável.
 */
export const SEM_RESPONSAVEL = "sem-responsavel";

type TarefaParaAba = {
  client_id: string | null;
  responsavel: string | null;
  status: string;
  data_vencimento: string | null;
};

/** `true` se o valor vindo da URL (?resp=) é um recorte que existe. */
export function respValido(valor: unknown): valor is string {
  return (
    valor === SEM_RESPONSAVEL || TEAM_MEMBERS.some((m) => m.value === valor)
  );
}

const ehDe = (t: TarefaParaAba, pessoa: string) =>
  pessoa === SEM_RESPONSAVEL ? !t.responsavel : t.responsavel === pessoa;

export function abasPorPessoa(
  tarefas: TarefaParaAba[],
  base: string,
  keyParam: string,
  ativo: string
): ViewTabItem[] {
  const abertas = tarefas.filter(
    (t) => t.client_id && t.data_vencimento && !isClosedTaskStatus(t.status as TaskStatus)
  );
  const projetosDe = (pessoa: string) =>
    new Set(
      abertas.filter((t) => ehDe(t, pessoa)).map((t) => t.client_id as string)
    );

  const sep = keyParam ? "&" : "?";
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
    out.push({
      value: m.value,
      label: m.label,
      iniciais: m.iniciais,
      cor: m.cor,
      count,
      href: `${base}${keyParam}${sep}resp=${encodeURIComponent(m.value)}`,
    });
  }
  const semDono = projetosDe(SEM_RESPONSAVEL).size;
  if (semDono > 0 || ativo === SEM_RESPONSAVEL) {
    // Sempre por último: é uma pendência de organização, não uma pessoa.
    out.push({
      value: SEM_RESPONSAVEL,
      label: "Sem responsável",
      count: semDono,
      href: `${base}${keyParam}${sep}resp=${SEM_RESPONSAVEL}`,
    });
  }
  return out;
}

/** Os clientes em que a pessoa tem tarefa com prazo em aberto. */
export function projetosDaPessoa(
  tarefas: TarefaParaAba[],
  pessoa: string
): Set<string> {
  return new Set(
    tarefas
      .filter(
        (t) =>
          t.client_id &&
          t.data_vencimento &&
          !isClosedTaskStatus(t.status as TaskStatus) &&
          ehDe(t, pessoa)
      )
      .map((t) => t.client_id as string)
  );
}
