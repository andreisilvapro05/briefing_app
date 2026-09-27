/**
 * Datas em sequência para agendar um lote de etapas de uma vez.
 *
 * Pedido da Karine (26/09): "os projetos sem datas o Andrei mesmo coloca
 * datas". Medido no mesmo dia: 247 das 286 tarefas abertas não têm prazo,
 * porque o checklist cria as ~10 etapas do fluxo na criação do projeto.
 * Uma por uma, num DueDatePicker por linha, isso não acontece.
 *
 * O intervalo é em DIAS ÚTEIS porque é assim que a agência conta — o prazo
 * do projeto é "12 dias úteis". Contar em dias corridos jogaria etapa pro
 * sábado e a data já nasceria errada.
 */

const DIA = 86_400_000;

/** Sábado (6) e domingo (0) não são dia de trabalho. */
function ehFimDeSemana(d: Date): boolean {
  const n = d.getUTCDay();
  return n === 0 || n === 6;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Empurra a data pro próximo dia útil, se ela cair no fim de semana.
 * Devolve a própria data quando já é dia útil.
 */
export function proximoDiaUtil(dataISO: string): string | null {
  const d = new Date(`${dataISO}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  while (ehFimDeSemana(d)) d.setTime(d.getTime() + DIA);
  return iso(d);
}

/**
 * `quantidade` datas a partir de `inicio`, espaçadas por `intervalo` dias
 * úteis. A primeira é o próprio início (empurrado pro dia útil seguinte se
 * cair no fim de semana).
 *
 * Intervalo 0 devolve a MESMA data para todas — é o caso "essas cinco
 * vencem no mesmo dia", que também é pedido de verdade.
 */
export function datasEmSequencia(
  inicio: string,
  quantidade: number,
  intervalo: number
): string[] {
  if (quantidade <= 0) return [];
  const primeira = proximoDiaUtil(inicio);
  if (!primeira) return [];

  const passo = Math.max(0, Math.floor(intervalo));
  const out: string[] = [];
  const cursor = new Date(`${primeira}T12:00:00Z`);

  for (let i = 0; i < quantidade; i += 1) {
    if (i > 0 && passo > 0) {
      let restam = passo;
      while (restam > 0) {
        cursor.setTime(cursor.getTime() + DIA);
        if (!ehFimDeSemana(cursor)) restam -= 1;
      }
    }
    out.push(iso(cursor));
  }
  return out;
}
