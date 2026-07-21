import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Parent surface card — one radius/elevation vocabulary (rounded-2xl / border /
 * shadow-e1) shared by every parent screen so home, attendance, fees etc. feel
 * like one product. `href` turns the whole card into a link with a subtle
 * hover-lift micro-interaction (respects global reduced-motion).
 */
export function Card({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const base = cn(
    "block rounded-2xl border border-border-default bg-surface p-4 shadow-e1",
    href && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-e2",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return <div className={base}>{children}</div>;
}

/** Card header row: title left, optional trailing status/action right. */
export function CardHead({
  title,
  trailing,
}: {
  title: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-body font-semibold text-text-primary">{title}</h2>
      {trailing}
    </div>
  );
}

/** A "see more" link row used at the bottom-right of summary cards. */
export function CardMore({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
    >
      {label}
      <ChevronRight size={16} />
    </Link>
  );
}
