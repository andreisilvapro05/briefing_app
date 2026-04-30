import { cn } from "@/lib/cn";
import type { EtapaProjeto } from "@/lib/types";

interface ProjectTimelineProps {
  etapas: EtapaProjeto[];
}

const statusStyles = {
  concluida: {
    dot: "bg-fysi-deep border-fysi-deep",
    label: "Concluída",
    pillClass: "bg-fysi-mint text-fysi-deep",
  },
  "em-andamento": {
    dot: "bg-fysi-yellow border-fysi-yellow",
    label: "Em andamento",
    pillClass: "bg-fysi-yellow text-fysi-deep",
  },
  pendente: {
    dot: "bg-white border-fysi-line-strong",
    label: "Pendente",
    pillClass: "bg-fysi-deep/[0.05] text-fysi-muted",
  },
} as const;

export function ProjectTimeline({ etapas }: ProjectTimelineProps) {
  return (
    <ol className="relative">
      {/* Linha vertical contínua representando "fluxo estruturado" */}
      <span
        aria-hidden
        className="absolute left-[19px] top-2 bottom-2 w-px bg-fysi-line"
      />

      {etapas.map((etapa) => {
        const styles = statusStyles[etapa.status];
        return (
          <li
            key={`${etapa.numero}-${etapa.titulo}`}
            className="relative pl-12 pb-8 last:pb-0"
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-2 top-1 h-5 w-5 rounded-full border-2 z-10",
                styles.dot
              )}
            />

            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-[0.7rem] uppercase tracking-[0.14em] font-medium text-fysi-muted">
                Etapa {String(etapa.numero).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.12em] font-medium",
                  styles.pillClass
                )}
              >
                {styles.label}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-medium tracking-tight text-fysi-deep">
              {etapa.titulo}
            </h3>
            <p className="text-xs text-fysi-muted mt-0.5">{etapa.prazo}</p>

            <ul className="mt-3 flex flex-col gap-1">
              {etapa.atividades.map((atividade, idx) => (
                <li
                  key={idx}
                  className="text-sm text-fysi-deep/70 leading-relaxed flex gap-2"
                >
                  <span
                    aria-hidden
                    className="text-fysi-green/60 select-none"
                  >
                    —
                  </span>
                  <span>{atividade}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
