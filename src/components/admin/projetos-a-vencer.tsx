import Link from "next/link";
import { Eyebrow } from "@/components/ui/pill";
import { formatDiaMesCurto } from "@/lib/datas";
import type { ProjetoAVencer, ResumoAVencer, Situacao } from "@/lib/projetos-a-vencer";

/**
 * "Projetos a vencer" — pedido da Karine (24/09), apontando pra uma tela com
 * as colunas ETAPA / PROGRESSO / STATUS.
 *
 * A unidade aqui é o PROJETO, não a tarefa: a pergunta é "que cliente está
 * prestes a estourar", e o prazo mostrado é o da tarefa aberta que vence
 * primeiro. Quem quer a lista de tarefas soltas tem a seção logo abaixo.
 */

const TOM: Record<Situacao, { pill: string; label: string; barra: string }> = {
  atrasado: {
    pill: "bg-red-50 text-red-700 border-red-200",
    label: "Atrasado",
    barra: "bg-red-500",
  },
  atencao: {
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Atenção",
    barra: "bg-amber-500",
  },
  "no-prazo": {
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "No prazo",
    barra: "bg-emerald-500",
  },
};

/** "atrasado 4 dias", "vence hoje", "em 6 dias" — a frase, não o número cru. */
function quando(dias: number): string {
  if (dias < 0) return `atrasado ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `em ${dias} dias`;
}

function Linha({ p, keyParam }: { p: ProjetoAVencer; keyParam: string }) {
  const tom = TOM[p.situacao];
  const pct = p.total > 0 ? Math.round((p.fechadas / p.total) * 100) : 0;
  return (
    <Link
      href={`/admin/${p.clientId}${keyParam}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] items-center gap-x-4 gap-y-1 rounded-md px-2 py-2 hover:bg-fysi-cream/60 transition"
    >
      <div className="min-w-0">
        <span className="text-sm text-fysi-deep font-medium truncate block">{p.nome}</span>
        <span className="text-[0.7rem] text-fysi-muted truncate block">
          {p.tarefa}
          {p.responsavel ? ` · ${p.responsavel}` : ""}
        </span>
      </div>

      <div className="hidden sm:block min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-fysi-muted min-w-0">
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: p.etapaCor }}
          />
          <span className="truncate">{p.etapa}</span>
        </span>
      </div>

      <div className="hidden sm:block">
        {p.total > 0 ? (
          <>
            <div className="flex items-baseline justify-between text-[0.7rem] text-fysi-muted mb-0.5">
              <span className="tabular-nums">
                {p.fechadas}/{p.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-fysi-line overflow-hidden">
              <div
                className={`h-full rounded-full ${tom.barra}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <span className="text-[0.7rem] text-fysi-muted">sem tarefas</span>
        )}
      </div>

      <div className="text-right shrink-0">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${tom.pill}`}
        >
          {tom.label}
        </span>
        <span className="block text-[0.7rem] text-fysi-muted mt-0.5 whitespace-nowrap">
          {formatDiaMesCurto(p.vencimento)} · {quando(p.dias)}
        </span>
      </div>
    </Link>
  );
}

export function ProjetosAVencer({
  resumo,
  keyParam,
  janelaDias,
  totalNaJanela,
}: {
  resumo: ResumoAVencer;
  keyParam: string;
  janelaDias: number;
  /** Quantos existem ao todo, quando a lista foi cortada por limite. */
  totalNaJanela: number;
}) {
  const { itens, atrasados, semData } = resumo;
  return (
    <section className="bg-white border border-fysi-line rounded-[20px] shadow-fysi-card p-5 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <Eyebrow>Projetos a vencer</Eyebrow>
        <Link
          href={`/admin/lista${keyParam}`}
          className="text-xs text-fysi-deep hover:underline font-medium shrink-0"
        >
          Ver todos →
        </Link>
      </div>
      <p className="text-[0.7rem] text-fysi-muted mb-3">
        O prazo é o da tarefa aberta que vence primeiro. Próximos {janelaDias} dias
        {atrasados > 0 ? (
          <>
            {" · "}
            <span className="text-red-700 font-medium">
              {atrasados} {atrasados === 1 ? "atrasado" : "atrasados"}
            </span>
          </>
        ) : null}
        {semData > 0 ? ` · ${semData} sem data` : ""}
      </p>

      {itens.length === 0 ? (
        <p className="text-sm text-fysi-muted py-6 text-center">
          Nenhum projeto vence nos próximos {janelaDias} dias.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-fysi-line/60">
          {itens.map((p) => (
            <Linha key={p.clientId} p={p} keyParam={keyParam} />
          ))}
        </div>
      )}

      {totalNaJanela > itens.length ? (
        <p className="text-[0.7rem] text-fysi-muted mt-3 text-center">
          mostrando {itens.length} de {totalNaJanela}
        </p>
      ) : null}
    </section>
  );
}
