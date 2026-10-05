import { TEAM_MEMBERS, isClosedTaskStatus, type TaskStatus } from "./project-tasks";
import type { ViewTabItem } from "@/components/admin/view-tabs";

/**
 * As abas por pessoa das duas telas que mostram projetos agrupados por
 * status (Visão Geral e Lista) — as "Lista Karine", "Lista Andrei" do
 * ClickUp.
 *
 * As abas de pessoa NÃO têm número. A Karine mandou tirar ("não é para
 * aparecer quantas tarefas cada um tem ali, liste os nomes"): a barra
 * serve pra escolher de quem é a lista, e dois números por nome — o com
 * prazo e o "+N sem prazo" — pediam uma legenda embaixo pra significar
 * alguma coisa. O número sobrou só em "Todos", que diz o tamanho da lista.
 */

/**
 * Aba do trabalho que tem prazo e não tem dono. Não é membro da equipe, por
 * isso o valor não pode colidir com nenhum `TEAM_MEMBERS[].value`.
 *
 * Sem ela esse trabalho ficava invisível: aparecia em "Todos" e em nenhuma
 * aba de pessoa, então ninguém que abrisse o próprio recorte via que havia
 * projeto com data marcada e sem responsável.
 *
 * O valor é o MESMO que /admin/tarefas já usa no `?resp=` (`SEM_DONO`).
 * Precisa ser: as duas telas compartilham a URL, e um sentinela diferente
 * em cada uma faria a aba morrer ao navegar de uma pra outra.
 */
export const SEM_RESPONSAVEL = "__sem__";

type TarefaParaAba = {
  client_id: string | null;
  responsavel: string | null;
  status: string;
  data_vencimento: string | null;
};

/**
 * O projeto com o dono DELE — a coluna "Resp." que a lista mostra.
 *
 * Existe porque o recorte olhava só as tarefas, e o Andrei é o gestor de
 * quase todo projeto sem ser o dono de nenhuma etapa: o avatar dele
 * aparecia em todas as linhas e a aba dele vinha vazia (Karine, 30/09:
 * "Andrei está marcado, mas não aparece ao clicar nele"). Quem manda aqui
 * é o mesmo valor que a coluna mostra, senão clicar no avatar da linha
 * não traz a linha.
 */
export type ProjetoParaAba = { id: string; responsavel: string | null };

/**
 * Karine e Andrei primeiro — pedido dela em 30/09. Só reordena a BARRA;
 * `TEAM_MEMBERS` segue como está, porque a ordem dele também vale para os
 * campos de "responsável" espalhados pelo app, onde alfabética é melhor.
 */
const PRIMEIROS = ["karine", "andrei"];

export function naOrdemDaBarra<T extends { value: string }>(membros: T[]): T[] {
  const posicao = (v: string) => {
    const i = PRIMEIROS.indexOf(v);
    return i === -1 ? PRIMEIROS.length : i;
  };
  return membros
    .map((m, i) => ({ m, i }))
    .sort((a, b) => posicao(a.m.value) - posicao(b.m.value) || a.i - b.i)
    .map((x) => x.m);
}

/** `true` se o valor vindo da URL (?resp=) é um recorte que existe. */
export function respValido(valor: unknown): valor is string {
  return (
    valor === SEM_RESPONSAVEL || TEAM_MEMBERS.some((m) => m.value === valor)
  );
}

const ehDe = (t: TarefaParaAba, pessoa: string) =>
  pessoa === SEM_RESPONSAVEL ? !t.responsavel : t.responsavel === pessoa;

/**
 * @param totalProjetos quantos projetos a LISTA mostra. Sem isso, a aba
 * "Todos" contava só os projetos com tarefa datada e dizia "Todos 6" em
 * cima de uma lista de 25 — dois números que se contradiziam na mesma
 * tela (print da Karine, 28/09). A aba tem que contar o que o clique
 * revela; o corte por prazo continua valendo nas abas de PESSOA, que é
 * onde ele responde "o que está de fato ativo".
 */
export function abasPorPessoa(
  tarefas: TarefaParaAba[],
  base: string,
  keyParam: string,
  ativo: string,
  totalProjetos?: number,
  projetos: ProjetoParaAba[] = []
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
      count:
        totalProjetos ??
        new Set(abertas.map((t) => t.client_id as string)).size,
      href: `${base}${keyParam}`,
    },
  ];
  for (const m of naOrdemDaBarra(TEAM_MEMBERS)) {
    /**
     * Entra na barra quem tem trabalho aberto de qualquer espécie: tarefa
     * com data, tarefa sem data, ou um projeto sob responsabilidade dele.
     *
     * A primeira condição sozinha deixava a barra com uma pessoa só (em
     * 27/09 só a Valéria tinha tarefa com prazo). A terceira é o caso do
     * Andrei: ele é o gestor dos projetos e não é dono de etapa nenhuma.
     */
    const temTrabalho =
      projetosDe(m.value).size > 0 ||
      projetosSemPrazoDe(tarefas, m.value).size > 0 ||
      projetos.some((p) => p.responsavel === m.value);
    if (!temTrabalho && ativo !== m.value) continue;
    out.push({
      value: m.value,
      label: m.label,
      iniciais: m.iniciais,
      cor: m.cor,
      href: `${base}${keyParam}${sep}resp=${encodeURIComponent(m.value)}`,
    });
  }
  const orfaos =
    projetosDe(SEM_RESPONSAVEL).size > 0 ||
    projetos.some((p) => !p.responsavel);
  if (orfaos || ativo === SEM_RESPONSAVEL) {
    // Sempre por último: é uma pendência de organização, não uma pessoa.
    out.push({
      value: SEM_RESPONSAVEL,
      label: "Sem responsável",
      href: `${base}${keyParam}${sep}resp=${SEM_RESPONSAVEL}`,
    });
  }
  return out;
}

/** Clientes em que a pessoa tem tarefa aberta e SEM prazo. */
export function projetosSemPrazoDe(
  tarefas: TarefaParaAba[],
  pessoa: string
): Set<string> {
  return new Set(
    tarefas
      .filter(
        (t) =>
          t.client_id &&
          !t.data_vencimento &&
          !isClosedTaskStatus(t.status as TaskStatus) &&
          ehDe(t, pessoa)
      )
      .map((t) => t.client_id as string)
  );
}

/**
 * Os projetos da pessoa: aqueles em que ela tem tarefa com prazo em aberto,
 * MAIS aqueles em que ela é a responsável do projeto.
 *
 * A segunda metade é a correção de 30/09. O recorte olhava só as tarefas, e
 * o Andrei — gestor de projetos — não é dono de etapa nenhuma: a coluna
 * "Resp." mostrava o avatar dele em toda linha e a aba dele abria vazia.
 * `projetos` é a mesma fonte que a coluna usa, então clicar no nome traz
 * exatamente as linhas que exibem aquele avatar.
 */
export function projetosDaPessoa(
  tarefas: TarefaParaAba[],
  pessoa: string,
  projetos: ProjetoParaAba[] = [],
  /**
   * `"gestor"` = só os projetos em que a pessoa é a RESPONSÁVEL, ignorando
   * as tarefas.
   *
   * Karine (04/10): "completo a copy só, não é para aparecer como meu
   * projeto". Ela é a dona da etapa de copy em quase todo projeto da
   * agência — pela regra de união, os 24 viravam "meus projetos" dela em
   * Meu Trabalho, o que não diz nada.
   *
   * O padrão (`"qualquer"`) continua unindo as duas coisas, porque é o que
   * o FILTRO por pessoa da Lista e da Visão Geral precisa: lá a pergunta é
   * "em que projetos essa pessoa encosta", e foi pra isso que a união foi
   * criada (o Andrei é gestor de 36 projetos e dono de etapa nenhuma).
   *
   * São duas perguntas diferentes com a mesma cara — ver
   * [[trap_dono_projeto_vs_dono_tarefa]].
   */
  escopo: "qualquer" | "gestor" = "qualquer"
): Set<string> {
  const out = new Set<string>();
  for (const p of projetos) {
    const dele = pessoa === SEM_RESPONSAVEL ? !p.responsavel : p.responsavel === pessoa;
    if (dele) out.add(p.id);
  }
  if (escopo === "gestor") return out;
  for (const t of tarefas) {
    if (
      t.client_id &&
      t.data_vencimento &&
      !isClosedTaskStatus(t.status as TaskStatus) &&
      ehDe(t, pessoa)
    ) {
      out.add(t.client_id);
    }
  }
  return out;
}
