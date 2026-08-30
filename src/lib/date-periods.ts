export type Periodo = "semana" | "mes";

/**
 * Início do período corrente (semana começa domingo), em horário local.
 * Usado pelos filtros de período em /admin/lista e /admin/contratos.
 */
export function inicioDoPeriodo(periodo: Periodo, now: Date = new Date()): Date {
  if (periodo === "semana") {
    const inicio = new Date(now);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    return inicio;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
