"use client";

/**
 * Abre a conversa do WhatsApp COM AQUELE cliente, já com a mensagem
 * escrita.
 *
 * Diferente do botão do link /contratar, que abre a folha de
 * compartilhamento genérica: aqui o número do cliente já está na ficha, e
 * um passo a menos é a diferença entre mandar e deixar pra depois.
 *
 * Existe porque o link do briefing só tinha "Copiar" enquanto o do
 * contrato tinha WhatsApp — e o resultado está no banco: 39 dos 44
 * clientes preencheram o contrato, 7 responderam o briefing.
 */
export function AbrirWhatsAppButton({
  href,
  label = "WhatsApp",
  title,
}: {
  /** Link wa.me já montado no servidor. Null esconde o botão. */
  href: string | null;
  label?: string;
  title?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? "Abrir conversa no WhatsApp com a mensagem pronta"}
      className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-fysi-line bg-white px-2.5 py-1 text-xs font-medium text-fysi-deep hover:border-fysi-deep/40 transition"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.8-2.1c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.4l.8 1.9c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.6.1.2.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2Z" />
      </svg>
      {label}
    </a>
  );
}
