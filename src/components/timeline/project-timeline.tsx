import { cn } from "@/lib/cn";
import type { EtapaProjeto } from "@/lib/types";
import type { SituacaoCopy } from "@/lib/copy-documento";

/**
 * Rótulos da copy na voz do CLIENTE — os de copy-documento.ts são pra
 * equipe ("Com o cliente", "Rascunho") e não fazem sentido pra quem está
 * do outro lado. "rascunho" nunca chega aqui: sem link ligado o botão
 * inteiro não aparece.
 */
const COPY_LABEL_CLIENTE: Record<SituacaoCopy, string> = {
  rascunho: "Em preparação",
  aguardando: "Esperando você",
  "ajuste-pedido": "Ajuste pedido",
  aprovada: "Aprovada por você",
};

/** Vermelho não entra: pedir ajuste é parte do processo, não erro. */
const COPY_TOM_CLIENTE: Record<SituacaoCopy, string> = {
  rascunho: "border-fysi-line bg-fysi-deep/[0.04] text-fysi-muted",
  aguardando: "border-sky-200 bg-sky-50 text-sky-700",
  "ajuste-pedido": "border-amber-200 bg-amber-50 text-amber-800",
  aprovada: "border-fysi-mint bg-fysi-mint/40 text-fysi-deep",
};

interface ProjectTimelineProps {
  etapas: EtapaProjeto[];
  // Link da copy pra cliente revisar. Mostra um botão na etapa "Criação da copy".
  copyReviewLink?: string | null;
  /** Estado da copy quando ela é a do app — null pro link antigo do Drive. */
  copySituacao?: SituacaoCopy | null;
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

export function ProjectTimeline({
  etapas,
  copyReviewLink,
  copySituacao = null,
}: ProjectTimelineProps) {
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

            {/* CTA: link de revisão da copy quando admin disponibiliza.
                Desde 01/10 o link pode ser a copy DENTRO do app
                (/copy/<token>) em vez da pasta do Drive — e aí o app sabe
                em que pé ela está e diz, no lugar de oferecer "revisar" a
                uma copy que o próprio cliente já aprovou. */}
            {etapa.titulo === "Criação da copy" && copyReviewLink ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={copyReviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-4 py-2 hover:bg-fysi-deep/90"
                >
                  {copySituacao === "aprovada"
                    ? "Ver a copy aprovada →"
                    : copySituacao === "ajuste-pedido"
                      ? "Ver o ajuste que você pediu →"
                      : "Revisar a copy →"}
                </a>
                {copySituacao ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${COPY_TOM_CLIENTE[copySituacao]}`}
                  >
                    {COPY_LABEL_CLIENTE[copySituacao]}
                  </span>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
