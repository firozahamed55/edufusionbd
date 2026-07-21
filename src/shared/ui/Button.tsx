import { cn } from "@/shared/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-text-on-primary hover:bg-primary-hover",
  secondary:
    "bg-surface border border-border-strong text-text-primary hover:bg-sunken",
  tertiary: "bg-primary-subtle text-primary hover:brightness-95",
  ghost: "text-text-secondary hover:bg-sunken",
  danger: "bg-danger-fg text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-meta",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Design-system Button. Colors are semantic tokens → correct in light & dark. */
export function Button({
  variant = "primary",
  size = "md",
  type,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      // Default to "button" so a Button placed inside a <form> never submits it
      // implicitly; callers opt in with type="submit" where that is intended.
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
