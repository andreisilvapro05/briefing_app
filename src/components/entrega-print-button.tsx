"use client";

/**
 * Botão "Baixar PDF" da página pública de entrega.
 *
 * Dispara o print nativo do browser — o usuário escolhe "Salvar como PDF"
 * no diálogo de impressão. O CSS @media print do page.tsx cuida de esconder
 * header/botões e ajustar margens pra virar um documento limpo.
 */
export function EntregaPrintButton() {
  function baixarPdf() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <button
      type="button"
      onClick={baixarPdf}
      className="inline-flex items-center gap-2 rounded-full bg-fysi-deep text-fysi-cream text-sm font-medium px-5 py-2.5 hover:bg-fysi-deep/90 transition print:hidden"
    >
      <span aria-hidden>⬇</span> Baixar PDF
    </button>
  );
}
