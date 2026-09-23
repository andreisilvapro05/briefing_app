import Link from "next/link";
import {
  QUADRANTES_PROJETO,
  quadranteDoProjeto,
  type ProjetoNaMatriz,
} from "@/lib/prioridades-projetos";
import { TASK_STATUS_OPTIONS, TASK_STATUS_TONE, type TaskStatus } from "@/lib/project-tasks";

/**
 * Os projetos em andamento, colocados em quatro caixas por urgência do
 * prazo × quanto ainda falta.
 *
 * É uma GRADE, não um gráfico de pontos como o das iniciativas. Motivo: aqui
 * ninguém digita nota — os dois eixos são calculados —, então o que interessa
 * é "em que caixa este projeto caiu e por quê", não a posição exata. Uma
 * grade responde isso sem o balãozinho de rótulo que o gráfico precisa.
 */
export function MatrizProjetos({
  projetos,
  keyParam,
}: {
  projetos: ProjetoNaMatriz[];
  keyParam: string;
}) {
  const porQuadrante = new Map<string, ProjetoNaMatriz[]>();
  for (const p of projetos) {
    const q = quadranteDoProjeto(p);
    const arr = porQuadrante.get(q);
    if (arr) arr.push(p);
    else porQuadrante.set(q, [p]);
  }

  if (projetos.length === 0) {
    return (
      <p className="text-sm text-fysi-muted py-10 text-center">
        Nenhum projeto em andamento. Concluído e entregue não entram aqui — a
        matriz é sobre o que ainda precisa de decisão.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fysi-muted max-w-3xl">
        Ninguém digita nota aqui: a <strong className="text-fysi-deep">urgência</strong>{" "}
        vem do prazo mais próximo entre as tarefas abertas e de há quanto tempo
        o cliente não dá sinal; <strong className="text-fysi-deep">o que falta</strong>{" "}
        vem da proporção de tarefas ainda abertas. Projeto sem nenhuma tarefa
        gerada conta como “falta tudo” — não dá pra dizer que está quase pronto
        quando ninguém sabe o que fazer.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTES_PROJETO.map((q) => {
          const lista = (porQuadrante.get(q.id) ?? []).sort(
            (a, b) => b.urgencia - a.urgencia || b.falta - a.falta
          );
          return (
            <section
              key={q.id}
              className={`rounded-[16px] border p-4 ${q.tom}`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <h2 className={`text-sm font-semibold ${q.texto}`}>{q.titulo}</h2>
                <span className="text-xs text-fysi-muted tabular-nums">
                  {lista.length}
                </span>
              </div>
              <p className="text-[0.72rem] text-fysi-muted mb-3">{q.subtitulo}</p>

              {lista.length === 0 ? (
                <p className="text-xs text-fysi-muted/80 py-2">Nada aqui.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {lista.map((p) => (
                    <li key={p.clientId}>
                      <Link
                        href={`/admin/${p.clientId}${keyParam}`}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] bg-white/80 border border-white px-3 py-2 hover:border-fysi-deep/30 transition"
                      >
                        <span className="font-medium text-fysi-deep text-sm truncate max-w-full">
                          {p.nome}
                        </span>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-medium ${
                            TASK_STATUS_TONE[p.status as TaskStatus] ?? ""
                          }`}
                        >
                          {TASK_STATUS_OPTIONS.find((o) => o.value === p.status)
                            ?.label ?? p.status}
                        </span>
                        <span className="w-full text-[0.7rem] text-fysi-muted">
                          {p.porque}
                          {p.total > 0
                            ? ` · ${p.abertas} de ${p.total} tarefas abertas`
                            : " · nenhuma tarefa gerada"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
