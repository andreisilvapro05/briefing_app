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
 * Wordmark oficial "fysilab" (logotipo serifado da identidade).
 * `light` = versão menta pra fundos escuros; padrão = verde-petróleo (Dark Core)
 * pra fundos claros. Assets transparentes em /public.
 */
export function FysiWordmark({
  className,
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={light ? "/fysilab-light.png" : "/fysilab.png"}
      alt="Fysi Lab"
      draggable={false}
      className={cn("h-7 md:h-8 w-auto select-none", className)}
    />
  );
}
