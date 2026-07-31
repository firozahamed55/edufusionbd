import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-text-on-primary hover:bg-primary-hover",
  secondary:
    "bg-surface border border-border-strong text-text-primary hover:bg-sunken",
  tertiary: "bg-primary-subtle text-primary hover:bg-primary-subtle/70",
  ghost: "text-text-secondary hover:bg-sunken",
  danger: "bg-danger-solid text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-meta",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, sets aria-busy, and disables the button. */
  loading?: boolean;
}

/**
 * The Button's classes, for the one case a Button cannot serve: navigation.
 * A `<button onClick={router.push}>` is not a link — no middle-click, no
 * "open in new tab", no prefetch, and the wrong role for assistive tech. Put
 * this on a `<Link>` instead of copying the class string per call site.
 */
export const buttonClass = (variant: Variant = "primary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

/**
 * Design-system Button. Colors are semantic tokens → correct in light & dark.
 *
 * `loading` exists so async actions stop re-implementing pending UI at every
 * call site (audit S-7) — and, more importantly, so they stop *omitting* it and
 * letting an operator double-submit a fee collection or a result process.
 */
export function Button({
  variant = "primary",
  size = "md",
  type,
  className,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // Default to "button" so a Button placed inside a <form> never submits it
      // implicitly; callers opt in with type="submit" where that is intended.
      type={type ?? "button"}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading ? <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
