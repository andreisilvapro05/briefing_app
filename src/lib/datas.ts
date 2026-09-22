/**
 * Formatação de datas de prazo (YYYY-MM-DD) — um lugar só.
 *
 * Existiam quatro cópias quase iguais disso no app (ficha do cliente, painel
 * da equipe, "Meu Trabalho" e os avisos), todas com o mesmo defeito: o
 * `try/catch` não protegia nada. `new Date("nao-e-data")` não lança — devolve
 * um Date inválido, e `toLocaleDateString` nele devolve a string literal
 * "Invalid Date". Um prazo gravado torto (importação do ClickUp, edição na
 * mão no banco) aparecia na tela como "Invalid Date", que não diz nem o que
 * está errado nem qual era o valor.
 *
 * Aqui a data inválida volta como veio: quem olha vê o valor cru e entende
 * que precisa arrumar aquele campo.
 */

/** Meio-dia UTC: somar/formatar não atravessa o dia por causa de fuso. */
export function dataValida(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "21 set" — cabe num chip. */
export function formatDiaMes(iso: string): string {
  const d = dataValida(iso);
  if (!d) return iso;
  return d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
    // pt-BR devolve "21 de set." — no chip cabe só "21 set".
    .replace(" de ", " ")
    .replace(".", "");
}

/** "24/09" — pros avisos, onde o ano é sempre o corrente. */
export function formatDiaMesCurto(iso: string): string {
  const d = dataValida(iso);
  if (!d) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** "21/09/26" — lista densa, onde o ano importa mas o espaço é curto. */
export function formatDataCurta(iso: string): string {
  const d = dataValida(iso);
  if (!d) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/** "21/09/2026" — tooltip, onde cabe a data inteira. */
export function formatDataCompleta(iso: string): string {
  const d = dataValida(iso);
  if (!d) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Hoje (YYYY-MM-DD) no fuso de Brasília — pro SERVIDOR, que roda em UTC.
 *
 * `new Date().toISOString().slice(0, 10)` dá a data em UTC: das 21h à
 * meia-noite em Brasília, "hoje" já é amanhã, e uma tarefa que vence hoje
 * aparece como atrasada. A versão de navegador é `hojeISO` em
 * task-pickers.tsx; esta é a mesma conta, sem React.
 */
const FMT_HOJE_BRASILIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function hojeEmBrasilia(): string {
  return FMT_HOJE_BRASILIA.format(new Date());
}
