import {
  AREAS,
  EISENHOWER,
  ESFORCOS,
  TASK_STATUS_INTERNO,
  TASK_STATUS_OPTIONS,
  TEAM_MEMBERS,
  type ProjectTask,
} from "./project-tasks";

/**
 * Por onde a lista é partida em gavetas.
 *
 * Pedido da Karine (28/09): "o filtro não funcionou tão bem, prefiro como é no
 * ClickUp — agrupar por... aí dá para escolher". Filtrar ESCONDE o resto;
 * agrupar mostra tudo, arrumado pelo eixo que interessa naquele momento. São
 * perguntas diferentes: "o que é da Tainá?" contra "como está distribuído?".
 *
 * Cada agrupamento diz três coisas: a chave de cada demanda, a ordem em que as
 * gavetas aparecem, e como rotular cada uma — inclusive a de quem não tem valor
 * nenhum ali, que é sempre a última.
 */
export type Agrupamento = "area" | "status" | "responsavel" | "importancia" | "esforco";

export interface Gaveta {
  chave: string;
  rotulo: string;
  /** A cor da barrinha à esquerda do título. */
  barra: string;
  tarefas: ProjectTask[];
}

export const SEM_VALOR = "__sem__";

/** Cor da barrinha por status, para a gaveta ter a mesma leitura que o selo. */
const BARRA_STATUS: Record<string, string> = {
  "a-iniciar": "bg-slate-300",
  "em-andamento": "bg-sky-500",
  parado: "bg-red-500",
  concluido: "bg-emerald-600",
};

export const AGRUPAMENTOS: Record<
  Agrupamento,
  {
    label: string;
    chave: (t: ProjectTask) => string;
    ordem: string[];
    rotulo: (chave: string) => string;
    barra: (chave: string) => string;
    semValor: string;
  }
> = {
  area: {
    label: "Área",
    chave: (t) => t.area || SEM_VALOR,
    ordem: AREAS.map((a) => a.value),
    rotulo: (k) => AREAS.find((a) => a.value === k)?.label ?? "Sem área",
    barra: (k) => AREAS.find((a) => a.value === k)?.barra ?? "bg-fysi-line",
    semValor: "Sem área",
  },
  status: {
    label: "Status",
    chave: (t) => t.status || SEM_VALOR,
    ordem: TASK_STATUS_INTERNO,
    rotulo: (k) => TASK_STATUS_OPTIONS.find((o) => o.value === k)?.label ?? "Sem status",
    barra: (k) => BARRA_STATUS[k] ?? "bg-fysi-line",
    semValor: "Sem status",
  },
  responsavel: {
    label: "Responsável",
    chave: (t) => t.responsavel || SEM_VALOR,
    ordem: TEAM_MEMBERS.map((m) => m.value),
    rotulo: (k) => TEAM_MEMBERS.find((m) => m.value === k)?.label ?? "Sem responsável",
    barra: (k) => TEAM_MEMBERS.find((m) => m.value === k)?.cor ?? "bg-fysi-line",
    semValor: "Sem responsável",
  },
  importancia: {
    label: "Importância",
    chave: (t) => t.eisenhower || SEM_VALOR,
    ordem: EISENHOWER.map((q) => q.value),
    rotulo: (k) => EISENHOWER.find((q) => q.value === k)?.label ?? "Sem classificar",
    barra: (k) => EISENHOWER.find((q) => q.value === k)?.ponto ?? "bg-fysi-line",
    semValor: "Sem classificar",
  },
  esforco: {
    label: "Tempo que leva",
    chave: (t) => t.esforco || SEM_VALOR,
    ordem: ESFORCOS.map((e) => e.value),
    rotulo: (k) => ESFORCOS.find((e) => e.value === k)?.label ?? "Sem estimativa",
    barra: () => "bg-fysi-line-strong",
    semValor: "Sem estimativa",
  },
};


/** Peso do quadrante de Eisenhower, do mais importante ao menos. */
export function pesoQuadrante(v: string | null): number {
  switch (v) {
    case "fazer":
      return 0;
    case "planejar":
      return 1;
    case "delegar":
      return 2;
    case "eliminar":
      return 4;
    default:
      return 3;
  }
}

/** Peso do tamanho da tarefa, do mais rápido ao mais longo. */
export function pesoEsforco(v: string | null): number {
  switch (v) {
    case "rapido":
      return 0;
    case "curto":
      return 1;
    case "medio":
      return 2;
    case "longo":
      return 3;
    default:
      return 4;
  }
}

export type OrdemDaLinha = "importancia" | "prazo" | "esforco";

function porPrazo(a: ProjectTask, b: ProjectTask): number {
  return (a.data_vencimento ?? "9999").localeCompare(b.data_vencimento ?? "9999");
}

/** Como as demandas se ordenam DENTRO de cada gaveta. */
export function ordenarDemandas(arr: ProjectTask[], ordem: OrdemDaLinha): ProjectTask[] {
  return arr.slice().sort((a, b) => {
    if (ordem === "prazo") return porPrazo(a, b);
    if (ordem === "esforco") {
      // Do mais rápido pro mais longo: é a ordem de quem quer limpar a lista.
      // Não estimado vai pro fim.
      const d = pesoEsforco(a.esforco) - pesoEsforco(b.esforco);
      return d !== 0 ? d : porPrazo(a, b);
    }
    // Importância: quadrante primeiro, prazo como desempate.
    const d = pesoQuadrante(a.eisenhower) - pesoQuadrante(b.eisenhower);
    return d !== 0 ? d : porPrazo(a, b);
  });
}

/**
 * Parte a lista nas gavetas do eixo escolhido.
 *
 * A ordem das gavetas é a canônica de cada eixo — as áreas na ordem da lista,
 * os status do começo ao fim do trabalho, os quadrantes do mais urgente ao
 * menos — e não alfabética, que não diz nada sobre o trabalho.
 *
 * Duas regras que evitam demanda sumindo da tela: uma chave que existe nos
 * dados mas não na lista canônica (um status antigo, alguém que saiu do time)
 * ainda ganha a sua gaveta; e quem não tem valor nenhum no eixo fica por
 * último, seja qual for o sentido.
 */
export function agruparDemandas(
  tarefas: ProjectTask[],
  agruparPor: Agrupamento,
  crescente: boolean,
  ordem: OrdemDaLinha
): Gaveta[] {
  const config = AGRUPAMENTOS[agruparPor];
  const porChave = new Map<string, ProjectTask[]>();
  for (const t of tarefas) {
    const k = config.chave(t);
    const arr = porChave.get(k);
    if (arr) arr.push(t);
    else porChave.set(k, [t]);
  }

  const conhecidas = crescente ? config.ordem : [...config.ordem].reverse();
  const gavetas: Gaveta[] = conhecidas.map((chave) => ({
    chave,
    rotulo: config.rotulo(chave),
    barra: config.barra(chave),
    tarefas: ordenarDemandas(porChave.get(chave) ?? [], ordem),
  }));
  for (const [chave, lista] of porChave) {
    if (chave === SEM_VALOR || conhecidas.includes(chave)) continue;
    gavetas.push({
      chave,
      rotulo: config.rotulo(chave),
      barra: "bg-fysi-line",
      tarefas: ordenarDemandas(lista, ordem),
    });
  }
  const sem = porChave.get(SEM_VALOR);
  if (sem && sem.length > 0) {
    gavetas.push({
      chave: SEM_VALOR,
      rotulo: config.semValor,
      barra: "bg-fysi-line",
      tarefas: ordenarDemandas(sem, ordem),
    });
  }
  return gavetas;
}
