import { cn } from "@/lib/cn";

interface StepIndicatorProps {
  steps: { id: string; label: string }[];
  currentStepId: string;
  completedIds?: string[];
  className?: string;
  // Quando definido, cada step vira um botão clicável que dispara onStepClick(id).
  onStepClick?: (id: string) => void;
}

/**
 * Indicador horizontal de passos do briefing.
 * Render minimalista — segue princípio do manual de "estrutura visível, não decorativa".
 */
export function StepIndicator({
  steps,
  currentStepId,
  completedIds = [],
  className,
  onStepClick,
}: StepIndicatorProps) {
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);

  return (
    <ol
      role="list"
      aria-label="Etapas do briefing"
      className={cn(
        "flex items-center gap-2 overflow-x-auto pb-1",
        className
      )}
    >
      {steps.map((step, idx) => {
        const isCompleted = completedIds.includes(step.id);
        const isCurrent = step.id === currentStepId;
        const isUpcoming = idx > currentIdx && !isCompleted;
        const isClickable = !!onStepClick && !isCurrent;

        const pillClass = cn(
          "flex items-center gap-2 shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
          isCompleted &&
            "bg-fysi-mint border-fysi-mint-vivid/40 text-fysi-deep",
          isCurrent &&
            !isCompleted &&
            "bg-fysi-deep border-fysi-deep text-fysi-cream",
          isUpcoming && "bg-transparent border-fysi-line text-fysi-muted",
          isClickable && "cursor-pointer hover:border-fysi-deep/40"
        );

        const inner = (
          <>
            <span className="font-medium">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "uppercase tracking-[0.1em] font-medium",
                isCurrent && "text-fysi-cream"
              )}
            >
              {step.label}
            </span>
          </>
        );

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? "step" : undefined}
          >
            {isClickable ? (
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                aria-label={`Ir para ${step.label}`}
                className={pillClass}
              >
                {inner}
              </button>
            ) : (
              <div className={pillClass}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
