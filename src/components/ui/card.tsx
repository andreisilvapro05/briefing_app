import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "cream" | "deep" | "mint" | "white";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  interactive?: boolean;
}

const tones: Record<Tone, string> = {
  cream: "bg-fysi-cream text-fysi-deep border border-fysi-line",
  white: "bg-white text-fysi-deep border border-fysi-line",
  deep: "bg-fysi-deep text-fysi-cream border border-fysi-deep",
  mint: "bg-fysi-mint text-fysi-deep border border-fysi-mint-vivid/40",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = "white", interactive, className, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[20px] p-6",
        tones[tone],
        interactive &&
          "cursor-pointer transition hover:border-fysi-deep/30 hover:-translate-y-0.5",
        className
      )}
      {...rest}
    />
  );
});

export function CardHeader({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...rest} />;
}

export function CardTitle({
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-medium tracking-tight", className)}
      {...rest}
    />
  );
}

export function CardDescription({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-fysi-muted leading-relaxed", className)}
      {...rest}
    />
  );
}

export function CardBody({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4", className)} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex items-center justify-end gap-3", className)}
      {...rest}
    />
  );
}
