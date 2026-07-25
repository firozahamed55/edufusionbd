import { cn } from "@/shared/lib/cn";
import { Breadcrumb, type Crumb } from "./Breadcrumb";

/**
 * The breadcrumb + h1 + subtitle block that opens every admin screen (audit M-8).
 *
 * It was copied into 40 screens. Notably, all 40 copies were byte-identical —
 * `mt-1.5 text-h4 font-bold text-text-primary` and `mt-1 text-meta text-text-muted`
 * with zero drift — so this extraction is not fixing an inconsistency, it is
 * preventing the one that arrives the first time somebody nudges the spacing on
 * the screen they happen to be working on. Forty places to change is forty chances
 * to change thirty-nine.
 *
 * Deliberately has no `actions` prop. Screens that pair the header with a button
 * already wrap it in their own flex row with their own alignment (`items-start
 * gap-3` on one screen, `items-end gap-4` on another, both correct for their
 * content). `className` lets those keep their wrapper and pass `flex-1` down,
 * which made the migration a pure substitution with byte-identical output rather
 * than a redesign of 40 layouts.
 */
export function PageHeader({
  crumbs,
  title,
  subtitle,
  className,
}: {
  crumbs: Crumb[];
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header className={cn(className)}>
      <Breadcrumb items={crumbs} />
      <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{title}</h1>
      {subtitle ? <p className="mt-1 text-meta text-text-muted">{subtitle}</p> : null}
    </header>
  );
}
