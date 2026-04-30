import { cn } from "@/lib/cn";

interface FysiMarkProps {
  className?: string;
  size?: number;
  title?: string;
}

/**
 * Símbolo "F" estilizado da Fysi Lab — fluxo contínuo.
 * Stroke-based para escalar bem em qualquer tamanho.
 */
export function FysiMark({ className, size = 24, title }: FysiMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M9 26V11C9 8.23858 11.2386 6 14 6H23"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M9 16H20"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Wordmark — símbolo + nome.
 */
export function FysiWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-medium tracking-tight",
        className
      )}
    >
      <FysiMark size={22} title="Fysi Lab" />
      <span className="text-[0.95rem]">
        Fysi <span className="text-fysi-muted">Lab</span>
      </span>
    </span>
  );
}
