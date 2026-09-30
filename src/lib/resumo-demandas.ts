import { AREAS, TASK_STATUS_GROUP, TEAM_MEMBERS, type ProjectTask } from "./project-tasks";

/**
 * O resumo do topo da tela de Demandas — o "quanto tem e onde dói" antes
 * de a pessoa abrir gaveta nenhuma.
 *
 * Karine (2026-09-30): "ter visão geral nas demandas internas e por
 * usuário também". A tela listava bem e não respondia de relance quantas
 * eram, quantas estavam atrasadas nem de quem.
 *
 * Só conta demanda ABERTA: concluída não é atenção que se precise dar.
 */

export interface FatiaResumo {
  value: string;
  label: string;
  /** Classe de cor da barrinha. */
  barra: string;
  abertas: number;
  atrasadas: number;
}

export interface ResumoDemandas {
  abertas: number;
  atrasadas: number;
  paraHoje: number;
  semPrazo: number;
  porArea: FatiaResumo[];
  porPessoa: FatiaResumo[];
  /** Maior contagem de área — pra barra proporcional na tela. */
  maiorArea: number;
}

const SEM = "__sem__";

export function resumoDasDemandas(
  tarefas: ProjectTask[],
  hoje: string
): ResumoDemandas {
  const abertas = tarefas.filter((t) => TASK_STATUS_GROUP[t.status] === "ativo");

  const atrasada = (t: ProjectTask) =>
    Boolean(t.data_vencimento) && (t.data_vencimento as string) < hoje;

  const fatias = (
    chaves: { value: string; label: string; barra: string }[],
    de: (t: ProjectTask) => string
  ): FatiaResumo[] =>
    chaves
      .map((c) => {
        const minhas = abertas.filter((t) => de(t) === c.value);
        return {
          ...c,
          abertas: minhas.length,
          atrasadas: minhas.filter(atrasada).length,
        };
      })
      // Gaveta vazia não entra no resumo: aqui o trabalho é responder
      // "onde está o peso", e zero não pesa. A lista abaixo é que precisa
      // mostrar a área vazia, e mostra.
      .filter((f) => f.abertas > 0);

  const porArea = fatias(
    [
      ...AREAS.map((a) => ({ value: a.value, label: a.label, barra: a.barra })),
      { value: SEM, label: "Sem área", barra: "bg-fysi-line-strong" },
    ],
    (t) => t.area || SEM
  );

  const porPessoa = fatias(
    [
      ...TEAM_MEMBERS.map((m) => ({
        value: m.value,
        label: m.label,
        barra: m.cor,
      })),
      { value: SEM, label: "Sem responsável", barra: "bg-fysi-line-strong" },
    ],
    (t) => t.responsavel || SEM
  );

  return {
    abertas: abertas.length,
    atrasadas: abertas.filter(atrasada).length,
    paraHoje: abertas.filter((t) => t.data_vencimento === hoje).length,
    semPrazo: abertas.filter((t) => !t.data_vencimento).length,
    porArea,
    porPessoa,
    maiorArea: porArea.reduce((m, f) => Math.max(m, f.abertas), 0),
  };
}
